## Goal

`public/js` altındaki 44 üretilmiş `.js` ikizini kalıcı olarak kaldırmak: tarayıcı 20 ayrı dosya yerine 2 paket yükler, `.ts` kaynakları `public/js/` içinde aynen kalır (yer değiştirme yok), `api/_lib` tarafına dokunulmaz (zaten `.ts`-direct, derleme yeşil).

## Success Criteria

- `public/js/*.js` ve `public/color-palette/*.js` ikizleri yok; yerine 2 gitignore'lu paket (`legacy-early`, `legacy-main`) + harici sourcemap'ler var.
- `scripts/emit-js.ts` ve `tsconfig.emit.json` silinir; `npm run` akışları paket üretiyor.
- Davranış aynı: e2e + unit kapılarının tamamı yeşil (bilinen hatalar hariç); init sıralaması, lazy yükleme zamanlaması, hata boru hattı değişmemiş.
- Ölü modüller (`va-init`, `color-picker`, `parser-utils`) kaynaklarıyla birlikte silinmiş.

## Approach

**Teklif: esbuild ile 2 adet IIFE paketi, bölmesiz (no-splitting), minify'siz v1.** Gerekçe: IIFE tek kapsam (scope) demektir — bugünkü 12 deferred classic'in çalışma sırası ve çıplak (bare) dosya-arası referansları birebir korunur; ESM+split ise her çıplak referans için el denetimi isterdi. 8 `import()` çağrısının hepsi `init.ts` içinde; bölmesiz IIFE'de bunlar pakete gömülür, `init`'in await sıralaması aynen çalışır (spike'ta zamanlama karşılaştırmasıyla doğrulanacak).

- `legacy-early`: 5 head dosyası (error-logger ilk — `window.onerror` erken kurulur), hiçbiri import içermez ve jQuery kullanmaz.
- `legacy-main`: kalan 7 classic + palette + 3 modül denetleyicisi + tüm ESM grafiği + gömülü dinamikler. Etiket CDN'lerden ve inline betikten sonra durur (jQuery + DOM hazır).
- Dosya adları sabit + tek `?v=<package.json version>` (6 el yapımı `?v=` jetonu ölür; esbuild giriş adı hash'ine izin vermez, manifest tesisatına değmez).
- Kaynaklar kıpırdamaz; giriş (entry) dosyaları `scripts/` altında yaşar.

Reddedilenler: ESM+split (çapraz-chunk ham referans denetimi pahalı; esbuild'in chunk'lar arası sıralama sorunu belgeli); webpack/rollup (bu şekle ağır); Next-native paketleme (kaynakları `app/`'ye taşımak gerekir — kapsam dışı).

## Steps

**Unit 0 — Ölü kod temizliği (bağımsız, önce inebilir).** `va-init.ts` (`analytics.ts:7-30` ile birebir aynı, etiketsiz), `color-picker.ts` (576 satır, etiketsiz, içe aktarılmıyor), `parser-utils.ts` (üretimde içe aktarılmıyor; tek tüketicisi testi) + `parser-utils.test.js` silinir. Doğrulama: `npm test`, `npm run lint`, `npm run typecheck`.

**Unit 1 — Spike (atılır).** Geçici `scripts/` girişleriyle 2 paket üretilir, geçici bir sayfada yüklenir; init sıralaması, `window.*` sözleşmeleri (~40 isim), DOMContentLoaded dinleyicileri (7 dosya), jQuery-hazır davranışı ve telemetry'e giden ilk hata örneği eski/yeni karşılaştırılır. Karar kapısı: zamanlama farkı yoksa devam.

**Unit 2 — Etiket + test göçü.** `legacy-scripts.ts` 20 → 7 etikete iner (2 paket + 4 CDN + 1 inline; sıra: early → CDN → inline → main). Yeniden yazılan testler: `script-loading` (sayı/sıra; JSX-script yasağı, hidrasyon dışı bırakma, inline testleri aynen kalır), `color-palette-selection` (`?v=` dizesi), `compact-chrome` ve `smoke` (paket içeriğine yönlenir), `static-assets` (paket çözümlemesi), CI determinizm adımı (paket hash'i).

**Unit 3 — Emit'in sökülmesi.** `scripts/emit-js.ts`, `tsconfig.emit.json` silinir; 44 ikiz diskten silinir; `.gitignore`/yorumlar pakete göre güncellenir; `package.json` pre-hook'ları pakete bağlanır. Rollback: bu birime kadar her şey `git revert` ile tek komutluk.

**Unit 4 — Doğrulama ve temizlik.** Tam kapılar + hata boru hattı örneği + mobil parse süresi gözlenir (830KB tek parse; regresyon olursa split fallback'u ayrı iş olarak açılır, bu planda yok).

## Validation Plan

- Her unit: `npm run typecheck`, `npm run lint`, `npx prettier --check` (dokunulanlar), `npm test` (793 test).
- Unit 1: eski/yeni init konsol sırası + ağ günlüğü diff'i (boş olmalı); `window.*` okuma listesi diff'i.
- Unit 2–3: `npm run test:browser` desktop tam süit (bilinen 2 hata dışında yeşil; **en yüksek riskli kapı bu**); mobilde yeni hata çıkmamalı (mevcut 11 pre-existing ile karşılaştır).
- Hata hattı: bilerek fırlatılan test hatasının telemetry'e aynı mesaj + fonksiyon adıyla düştüğü ve ignore-filtrelerinin aynı davrandığı e2e ile kanıtlanır (filtreler üçüncü-taraf desenli, paket URL'si aynı-host'tan geçtiği için etkilenmez).
- Determinizm: çift paketleme hash eşitliği (CI).

## Risks / Open Questions

- **Çalışma sırası/zamanlama:** giriş dosyasında etiket sırası açıkça yazılır; deferred + DCL korunur; spike diff'i kapı koyar.
- **Sıkı kip:** paket IIFE; en üst seviye `this`/bildirimsiz atama denetimi spike'ta (typecheck yeşilliği gerçek tanımsızları zaten eliyor).
- **jQuery zamanlaması:** paket etiketi CDN'lerden sonra; en üst seviyede `$()` çağrısı yok (kullanımlar fonksiyon/iç içe + 2 ready işleyici) — spike'ta doğrulanır.
- **Stack izleri:** minify yok + isimler korunur; harici sourcemap üretilir. Sunucu tarafı sourcemap çözümleme kapsam dışı (takip işi).
- **Önbellek:** tek `?v=` jetonu; sürüm yükseltmeden yayınlanan paket değişikliği eski istemcide tutulabilir (mevcut 6 jetonlu sistemde de aynı insiyatif vardı).

Open questions: None.

## Sources

- [https://esbuild.github.io/api/](https://esbuild.github.io/api/) — splitting yalnızca `esm` formatında çalışır (chunk'lar arası sıralama sorunu belgeli); çoklu giriş paylaşılan kodu ortak chunk'a ayırır; chunk adlarında `[hash]` desteklenir, giriş dosyası adları değiştirilemez.
