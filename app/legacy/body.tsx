// Converted from index.html by scripts/html-to-jsx.mjs (one-shot, then deleted).
// Own this file: edit the JSX directly. Served as an opaque HTML string via
// module-scope renderToStaticMarkup in app/page.tsx (zero React fibers, zero
// hydration inside); legacy vanilla scripts drive the DOM at runtime (tags
// composed by app/legacy/legacy-scripts.ts). Componentize top-down.
export default function LegacyBody() {
  return (
    <>
      {'\n  '}
      {/* Google Tag Manager (noscript) */}
      {'\n  '}
      <noscript
        dangerouslySetInnerHTML={{
          __html:
            '<iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NFRMGR33" height="0" width="0"\n      style="display:none;visibility:hidden"></iframe>',
        }}
      />
      {'\n  '}
      {/* End Google Tag Manager (noscript) */}
      {'\n  '}
      <a className="skip-link" href="#main">
        {'Ana içeriğe geç'}
      </a>
      {'\n  '}
      <nav aria-label="Primary" className="visually-hidden">
        {'\n    '}
        <a href="#output">{'Çıktı'}</a>
        {'\n    '}
        <a href="#historyPanel">{'Geçmiş'}</a>
        {'\n  '}
      </nav>
      {'\n  '}
      <main id="main" role="main">
        <h1 className="visually-hidden">{'GTAW Chatlog Magician'}</h1>
        {'\n    '}
        <div className="grid-container">
          {'\n      '}
          <div className="grid-x grid-margin-x">
            {'\n        '}
            <div className="cell small-12">
              {'\n\n          '}
              {/* Minimal Bilgilendirme Çubuğu (i18n & a11y Uyumlu) */}
              {'\n          '}
              {/* <aside id="maintenanceBanner" class="site-notice-banner" role="region" aria-label="Site duyurusu" data-i18n-aria-label="banner.ariaLabel">
            <div class="site-notice-body">
              <i class="fas fa-info-circle site-notice-icon" style="color: #38bdf8;" aria-hidden="true"></i>
              <span class="site-notice-text" data-i18n="banner.text">
                Telif ve lisans bildirimi hakkında:
              </span>
              <button type="button" id="openNoticeModalBtn" class="site-notice-btn" aria-haspopup="dialog" aria-controls="noticeModal">
                <span data-i18n="banner.action">Açıklamayı Oku</span> <i class="fas fa-arrow-right" style="font-size: 10px;" aria-hidden="true"></i>
              </button>
            </div>
            <button type="button" class="site-notice-close" id="maintenanceBannerClose" aria-label="Duyuruyu kapat" title="Duyuruyu kapat" data-i18n-aria-label="banner.close" data-i18n-title="banner.close">
              <i class="fas fa-times" aria-hidden="true"></i>
            </button>
          </aside> */}
              {'\n\n          '}
              <div className="quick-settings">
                {'\n            '}
                <div className="quick-field">
                  {'\n              '}
                  <label className="field-label" htmlFor="font-label" data-i18n="ui.size">
                    {'Boyut'}
                  </label>
                  {'\n              '}
                  <input
                    name="font-label"
                    id="font-label"
                    type="number"
                    min="8"
                    max="24"
                    step="0.5"
                    defaultValue={'12'}
                    aria-label="Yazı boyutu"
                    title="Yazı boyutu (px)"
                    data-i18n-title="ui.fontSizeTitle"
                    data-i18n-aria-label="ui.fontSizeTitle"
                  />
                  {'\n              '}
                  <div className="golden-sizes-hint" data-i18n="ui.goldenSizes">
                    {'Golden: 8, 10, 12, 15, 19, 24px'}
                  </div>
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="quick-field">
                  {'\n              '}
                  <label className="field-label" htmlFor="lineLengthInput" data-i18n="ui.length">
                    {'Uzunluk'}
                  </label>
                  {'\n              '}
                  <input
                    type="number"
                    id="lineLengthInput"
                    min="1"
                    defaultValue={'77'}
                    aria-label="Satır uzunluğu"
                    title="Bir satırda en fazla kaç karakter olacağı"
                    data-i18n-title="ui.lineLengthTitle"
                    data-i18n-aria-label="ui.lineLengthTitle"
                  />
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="quick-field quick-field--highlight">
                  {'\n              '}
                  <label
                    className="field-label"
                    htmlFor="characterNameInput"
                    data-i18n="ui.highlight"
                  >
                    {'Vurgula'}
                  </label>
                  {'\n              '}
                  <div className="input-group">
                    {'\n                '}
                    <input
                      type="text"
                      id="characterNameInput"
                      placeholder="Karakter adı girin"
                      autoComplete="off"
                      aria-label="Vurgulanacak karakter adı"
                      data-i18n-placeholder="ui.characterNamePlaceholder"
                      data-i18n-aria-label="ui.characterNamePlaceholder"
                    />
                    {'\n                '}
                    <div className="input-group-button">
                      {'\n                  '}
                      <button
                        className="button small success"
                        id="addCharacterBtn"
                        type="button"
                        aria-label="Karakter ekle"
                        data-i18n="ui.add"
                      >
                        {'Ekle'}
                      </button>
                      {'\n                  '}
                      <button
                        className="button small secondary"
                        id="showCharacterListBtn"
                        type="button"
                        aria-label="Karakter listesini aç"
                      >
                        <i className="fas fa-chevron-down" aria-hidden="true"></i>
                      </button>
                      {'\n                '}
                    </div>
                    {'\n                '}
                    <div id="characterNameDropdown" className="character-dropdown" role="listbox">
                      {'\n                '}
                    </div>
                    {'\n              '}
                  </div>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n          '}
              <label htmlFor="chatlogInput" data-i18n="ui.chatlogLabel">
                {'Sohbet Kaydı:'}
              </label>
              {'\n          '}
              <input
                type="file"
                id="chatlogFileInput"
                accept=".txt,.log"
                style={{ display: 'none' }}
                aria-label="Chatlog dosyası seç"
              />
              {'\n\n          '}
              <div className="textarea-container">
                {'\n            '}
                <textarea
                  id="chatlogInput"
                  className="form-control textarea-input"
                  rows={15}
                  placeholder="Chatlog'unuzu buraya yapıştırın veya yukarıdan TXT dosya yükleyin..."
                  aria-label="Chat log input"
                  data-i18n-placeholder="ui.chatlogPlaceholder"
                />
                {'\n          '}
              </div>
              {'\n\n          '}
              <div className="workspace-toolbar-row">
                {'\n              '}
                <div className="button-group minimal-group workspace-toolbar">
                  {'\n                '}
                  <div className="canvas-mode-switch" role="group" aria-label="Çalışma modu">
                    {'\n                  '}
                    <button
                      id="modeChat"
                      className="canvas-mode-switch__button is-active"
                      type="button"
                      aria-pressed="true"
                    >
                      {'\n                    '}
                      <i className="fas fa-comments" aria-hidden="true"></i>
                      {'\n                    '}
                      <span data-i18n="ui.modeChat">{'Sohbet'}</span>
                      {'\n                  '}
                    </button>
                    {'\n                  '}
                    <button
                      id="modeCanvas"
                      className="canvas-mode-switch__button"
                      type="button"
                      aria-pressed="false"
                    >
                      {'\n                    '}
                      <i className="fas fa-object-group" aria-hidden="true"></i>
                      {'\n                    '}
                      <span data-i18n="ui.modeCanvas">{'Canvas'}</span>
                      {'\n                  '}
                    </button>
                    {'\n                '}
                  </div>
                  {'\n\n                '}
                  <div
                    id="txtUploadArea"
                    className="txt-upload-area"
                    role="button"
                    tabIndex={0}
                    aria-label="Chatlog dosyası yükle"
                    title="TXT dosyası yükle veya sürükleyip bırak"
                  >
                    {'\n                  '}
                    <div className="txt-upload-content">
                      {'\n                    '}
                      <i className="fas fa-file-alt txt-upload-icon" aria-hidden="true"></i>
                      {'\n                    '}
                      <span className="txt-upload-text">{'TXT'}</span>
                      {'\n                    '}
                      <span className="txt-upload-hint" data-i18n="ui.upload">
                        {'Yükle'}
                      </span>
                      {'\n                  '}
                    </div>
                    {'\n                  '}
                    <div id="txtFileInfo" className="txt-file-info" style={{ display: 'none' }}>
                      {'\n                    '}
                      <i className="fas fa-file-check" aria-hidden="true"></i>
                      {'\n                    '}
                      <span id="txtFileName" className="txt-file-name"></span>
                      {'\n                    '}
                      <span id="txtFileSize" className="txt-file-size"></span>
                      {'\n                    '}
                      <button
                        type="button"
                        id="txtFileClear"
                        className="txt-file-clear"
                        title="Dosyayı temizle"
                        aria-label="Dosyayı temizle"
                      >
                        {'×'}
                      </button>
                      {'\n                  '}
                    </div>
                    {'\n                '}
                  </div>
                  {'\n\n                '}
                  <div className="local-project-toolbar" role="toolbar" aria-label="Proje araçları">
                    {'\n                  '}
                    <button
                      id="projectNew"
                      type="button"
                      title="Yeni proje"
                      aria-label="Yeni proje"
                      data-i18n-title="projects.new"
                      data-i18n-aria-label="projects.new"
                    >
                      <i className="fas fa-file" aria-hidden="true"></i>
                    </button>
                    {'\n                  '}
                    <button
                      id="projectOpen"
                      type="button"
                      title="BCMAG aç"
                      aria-label="BCMAG aç"
                      data-i18n-title="projects.open"
                      data-i18n-aria-label="projects.open"
                    >
                      <i className="fas fa-folder-open" aria-hidden="true"></i>
                    </button>
                    {'\n                  '}
                    <button
                      id="projectSave"
                      type="button"
                      title="BCMAG kaydet"
                      aria-label="BCMAG kaydet"
                      data-i18n-title="projects.save"
                      data-i18n-aria-label="projects.save"
                    >
                      <i className="fas fa-floppy-disk" aria-hidden="true"></i>
                    </button>
                    {'\n                  '}
                    <button
                      id="projectLocal"
                      type="button"
                      title="Yerel projeler"
                      aria-label="Yerel projeler"
                      data-i18n-title="projects.local"
                      data-i18n-aria-label="projects.local"
                    >
                      <i className="fas fa-box-archive" aria-hidden="true"></i>
                    </button>
                    {'\n                  '}
                    <button
                      id="projectStack"
                      type="button"
                      title="Görsel yığını"
                      aria-label="Görsel yığını"
                      data-i18n-title="projects.stack"
                      data-i18n-aria-label="projects.stack"
                    >
                      <i className="fas fa-images" aria-hidden="true"></i>
                    </button>
                    {'\n                  '}
                    <button
                      id="projectFonts"
                      type="button"
                      title="Özel fontlar"
                      aria-label="Özel fontlar"
                      data-i18n-title="projects.fonts"
                      data-i18n-aria-label="projects.fonts"
                    >
                      <i className="fas fa-font" aria-hidden="true"></i>
                    </button>
                    {'\n                  '}
                    <input
                      id="projectFileInput"
                      type="file"
                      accept=".bcmag,application/x-bcmag"
                      hidden
                    />
                    {'\n                  '}
                    <input
                      id="projectFontInput"
                      type="file"
                      accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
                      hidden
                    />
                    {'\n                '}
                  </div>
                  {'\n\n                '}
                  <div
                    className="chat-format-toolbar"
                    role="toolbar"
                    aria-label="Sohbet biçimlendirme araçları"
                  >
                    {'\n                  '}
                    <button
                      id="toggleBackground"
                      className="button warning"
                      aria-label="Arka planı aç veya kapat"
                      title="Arka plan opaklığı"
                    >
                      {'\n                    '}
                      <span className="bg-text">{'Arka Plan: Kapalı'}</span>
                      {'\n                  '}
                    </button>
                    {'\n\n                  '}
                    <button
                      id="toggleCharacterNameColoring"
                      className="button warning active"
                      aria-label="Karakter adı renklendirmesini aç veya kapat"
                      title="Karakter adı renklendirme"
                    >
                      {'\n                    '}
                      <span className="name-color-text">{'İsimler: Açık'}</span>
                      {'\n                  '}
                    </button>
                    {'\n\n                  '}
                    <button
                      id="toggleColorPalette"
                      className="button info"
                      aria-label="Renk paletini aç"
                      data-i18n="ui.color"
                    >
                      {'Renk'}
                    </button>
                    {'\n\n                  '}
                    <button
                      id="censorCharButton"
                      className="button secondary censor-char-button"
                      aria-label="Sansür karakterini kopyala"
                      title="Sansür karakterini kopyala"
                    >
                      {'÷'}
                    </button>
                    {'\n\n                  '}
                    <button
                      id="toggleCensorStyle"
                      className="button secondary"
                      aria-label="Sansür stilini değiştir"
                    >
                      {'\n                    '}
                      <span className="censor-text">{'Sansür: Yok'}</span>
                      {'\n                  '}
                    </button>
                    {'\n\n                  '}
                    <button
                      id="toggleFont"
                      className="button secondary"
                      aria-label="Yazı tipini değiştir"
                    >
                      {'\n                    '}
                      <span className="font-text">{'Arial'}</span>
                      {'\n                  '}
                    </button>
                    {'\n                '}
                  </div>
                  {'\n\n                '}
                  <details className="toolbar-overflow">
                    {'\n                  '}
                    <summary aria-label="Diğer ayarları aç" title="Diğer ayarlar">
                      {'\n                    '}
                      <i className="fas fa-ellipsis" aria-hidden="true"></i>
                      {'\n                  '}
                    </summary>
                    {'\n                  '}
                    <div className="toolbar-overflow__panel">
                      {'\n                    '}
                      <label
                        className="toolbar-overflow__field toolbar-overflow__field--select"
                        htmlFor="localeSelect"
                      >
                        {'\n                      '}
                        <span>
                          <i className="fas fa-globe" aria-hidden="true"></i>{' '}
                          <span data-i18n="locale.label">{'Dil'}</span>
                        </span>
                        {'\n                      '}
                        <select id="localeSelect" className="locale-select" aria-label="Dil seçimi">
                          {'\n                        '}
                          <option value={'auto'}>{'🌐 Otomatik (Tarayıcı)'}</option>
                          {'\n                        '}
                          <option value={'tr'}>{'Türkçe'}</option>
                          {'\n                        '}
                          <option value={'en'}>{'English'}</option>
                          {'\n                        '}
                          <option value={'es'}>{'Español'}</option>
                          {'\n                        '}
                          <option value={'ru'}>{'Русский'}</option>
                          {'\n                      '}
                        </select>
                        {'\n                    '}
                      </label>
                      {'\n                    '}
                      <label className="toolbar-overflow__field" htmlFor="lineSpacingInput">
                        {'\n                      '}
                        <span data-i18n="ui.lineSpacing">{'Satır aralığı'}</span>
                        {'\n                      '}
                        <input
                          type="number"
                          id="lineSpacingInput"
                          min="0.8"
                          max="3"
                          step="0.05"
                          defaultValue={'1.3'}
                          aria-label="Satır aralığı"
                          title="Satırlar arası dikey boşluk çarpanı"
                        />
                        {'\n                    '}
                      </label>
                      {'\n                    '}
                      <button
                        id="opsecBtn"
                        className="button secondary"
                        type="button"
                        aria-label="Opsec sansürleme"
                        title="Tek tıkla isimleri, telsiz konuşmacılarını ve telefon numaralarını sansürle"
                      >
                        {'\n                      '}
                        <i className="fas fa-user-secret" aria-hidden="true"></i>{' '}
                        <span>{'Opsec (Gizlilik)'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="openFilterModalBtn"
                        className="button secondary"
                        type="button"
                        aria-label="Sohbeti filtrele"
                        title="Kategoriye ve konuşmacıya göre satırları filtrele"
                      >
                        {'\n                      '}
                        <i className="fas fa-filter" aria-hidden="true"></i>{' '}
                        <span>{'Sohbet Filtresi'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="toggleGtawLook"
                        className="button secondary"
                        type="button"
                        aria-label="GTAW oyun stili"
                        title="Orijinal GTAW oyun yazı tipi, gölgesi ve aralığını aç/kapat"
                      >
                        {'\n                      '}
                        <i className="fas fa-gamepad" aria-hidden="true"></i>{' '}
                        <span className="gtaw-look-text">{'GTAW: Kapalı'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="floatingSysMsgToggle"
                        className="button secondary"
                        type="button"
                        aria-label="Sistem bildirimlerini aç veya kapat"
                        title="Sistem Bildirimleri: Gizli (Açmak için tıkla)"
                      >
                        {'\n                      '}
                        <i className="fas fa-filter-circle-xmark" aria-hidden="true"></i>
                        {'\n                      '}
                        <span className="sysmsg-text">{'Sistem Bildirimleri: Gizli'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="toggleItalicParsing"
                        className="button secondary active"
                        aria-label="İtalik ayrıştırmayı aç veya kapat"
                        title="İtalik metin ayrıştırma"
                      >
                        {'\n                      '}
                        <span className="italic-parsing-text">{'İtalik: Açık'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="toggleWhisperColoring"
                        className="button secondary active"
                        aria-label="Kısık ve alçak ses boyamasını aç veya kapat"
                        title="Kısık/Alçak ses boyama"
                      >
                        {'\n                      '}
                        <span className="whisper-coloring-text">{'Kısık/Alçak Ses: Açık'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="communityOpen"
                        className="button secondary"
                        type="button"
                        title="Topluluk presetleri"
                        aria-label="Topluluk presetlerini aç"
                      >
                        {'\n                      '}
                        <i className="fas fa-compass" aria-hidden="true"></i>
                        <span data-i18n="ui.presets">{'Presetler'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="openFeaturesBtn"
                        className="button secondary"
                        type="button"
                        aria-label="Özellik videoları"
                        title="Özellik videoları"
                      >
                        {'\n                      '}
                        <i className="fas fa-circle-play" aria-hidden="true"></i>
                        <span data-i18n="ui.features">{'Özellik videoları'}</span>
                        {'\n                    '}
                      </button>
                      {'\n                    '}
                      <button
                        id="showHelpBtn"
                        className="button secondary"
                        data-i18n="help.title"
                        data-i18n-aria-label="help.title"
                        aria-label="Yardım ve SSS"
                      >
                        {'Yardım ve SSS'}
                      </button>
                      {'\n                    '}
                      <button
                        id="openFeedbackBtn"
                        className="button secondary"
                        data-i18n="ui.feedback"
                        aria-label="İstek ve hata bildir"
                        title="Bize ulaşın"
                      >
                        {'İstek & Öneri'}
                      </button>
                      {'\n                  '}
                    </div>
                    {'\n                '}
                  </details>
                  {'\n              '}
                </div>
                {'\n          '}
              </div>
              {'\n          '}
              <div className="output-preview-surface">
                {'\n            '}
                <div
                  id="output"
                  className="output"
                  role="region"
                  aria-label="Formatted chat log output"
                ></div>
                {'\n          '}
              </div>
              {'\n          '}
              <div className="output-actions" role="toolbar" aria-label="Çıktı işlemleri">
                {'\n            '}
                <button
                  id="copyOutputImage"
                  className="button primary"
                  aria-label="Copy chat log or overlay"
                  title="Chatlog görselini panoya kopyalar — CTRL+V ile yapıştırabilirsiniz"
                >
                  {'\n              '}
                  <i className="fas fa-copy" aria-hidden="true"></i>{' '}
                  <span data-i18n="ui.copyImage">{'Kopyala'}</span>
                  {'\n            '}
                </button>
                {'\n            '}
                <button
                  id="downloadOutputTransparent"
                  className="button success"
                  aria-label="Download chat log or overlay"
                >
                  {'\n              '}
                  <i className="fas fa-download" aria-hidden="true"></i>{' '}
                  <span data-i18n="ui.downloadImage">{'İndir'}</span>
                  {'\n            '}
                </button>
                {'\n            '}
                <button
                  id="toggleContrast"
                  className="button secondary"
                  type="button"
                  aria-label="Metin kontrastını değiştir"
                  title="Metin kontrastını artır"
                >
                  {'\n              '}
                  <i className="fas fa-circle-half-stroke" aria-hidden="true"></i>
                  {'\n              '}
                  <span className="contrast-text">{'Kontrast: Kapalı'}</span>
                  {'\n            '}
                </button>
                {'\n          '}
              </div>
              {'\n\n          '}
              <section id="canvasWorkspace" className="canvas-workspace" hidden>
                {'\n            '}
                <div className="canvas-toolbar" role="toolbar" aria-label="Canvas araçları">
                  {'\n              '}
                  <input
                    id="canvasBackgroundInput"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    hidden
                  />
                  {'\n              '}
                  <input
                    id="canvasImageInput"
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp"
                    hidden
                  />
                  {'\n              '}
                  <button className="canvas-command" id="canvasBackgroundUpload" type="button">
                    {'\n                '}
                    <i className="fas fa-panorama" aria-hidden="true"></i>
                    <span data-i18n="canvas.background">{'Arka plan'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button className="canvas-command" id="canvasImageUpload" type="button">
                    {'\n                '}
                    <i className="fas fa-image" aria-hidden="true"></i>
                    <span data-i18n="canvas.addImage">{'Görsel ekle'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button type="button" className="canvas-command" id="canvasAddChat">
                    {'\n                '}
                    <i className="fas fa-comment-medical" aria-hidden="true"></i>
                    <span data-i18n="canvas.addChat">{'Chat bloğu ekle'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command"
                    id="canvasAddRedactionBox"
                    title="Sansür kutusu ekle"
                  >
                    {'\n                '}
                    <i className="fas fa-square" aria-hidden="true"></i>
                    <span>{'Sansür Kutusu'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command"
                    id="canvasDetectFaces"
                    title="Yüzleri algıla ve sansürle"
                  >
                    {'\n                '}
                    <i className="fas fa-user-shield" aria-hidden="true"></i>
                    <span>{'Yüz Algıla'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <span className="canvas-toolbar__separator" aria-hidden="true"></span>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command"
                    id="canvasUndo"
                    title="Geri al"
                    disabled
                  >
                    {'\n                '}
                    <i className="fas fa-undo" aria-hidden="true"></i>
                    <span data-i18n="canvas.undo">{'Geri al'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command"
                    id="canvasRedo"
                    title="İleri al"
                    disabled
                  >
                    {'\n                '}
                    <i className="fas fa-redo" aria-hidden="true"></i>
                    <span data-i18n="canvas.redo">{'İleri al'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command canvas-command--danger"
                    id="canvasClear"
                  >
                    {'\n                '}
                    <i className="fas fa-trash-can" aria-hidden="true"></i>
                    <span data-i18n="canvas.clear">{'Temizle'}</span>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <span className="canvas-toolbar__separator" aria-hidden="true"></span>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command canvas-command--icon"
                    id="canvasCopy"
                    title="Canvas görselini kopyala"
                    aria-label="Canvas görselini kopyala"
                    data-i18n-title="canvas.copyTitle"
                    data-i18n-aria-label="canvas.copyTitle"
                  >
                    {'\n                '}
                    <i className="fas fa-copy" aria-hidden="true"></i>
                    {'\n              '}
                  </button>
                  {'\n              '}
                  <button
                    type="button"
                    className="canvas-command canvas-command--icon"
                    id="canvasDownload"
                    title="Canvas görselini indir"
                    aria-label="Canvas görselini indir"
                    data-i18n-title="canvas.downloadTitle"
                    data-i18n-aria-label="canvas.downloadTitle"
                  >
                    {'\n                '}
                    <i className="fas fa-download" aria-hidden="true"></i>
                    {'\n              '}
                  </button>
                  {'\n              '}
                </div>
                {'\n            '}
                <div className="canvas-settings" aria-label="Canvas ayarları">
                  {'\n              '}
                  <label
                    className="canvas-field canvas-field--color"
                    htmlFor="canvasBackgroundColor"
                  >
                    {'\n                '}
                    <span data-i18n="canvas.background">{'Arka plan'}</span>
                    {'\n                '}
                    <input id="canvasBackgroundColor" type="color" defaultValue={'#000000'} />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label
                    className="canvas-field canvas-field--range"
                    htmlFor="canvasBackgroundOpacity"
                  >
                    {'\n                '}
                    <span data-i18n="canvas.opacity">{'Opaklık'}</span>
                    {'\n                '}
                    <input
                      id="canvasBackgroundOpacity"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      defaultValue={'1'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label
                    className="canvas-field canvas-field--range"
                    htmlFor="canvasBackgroundBlur"
                  >
                    {'\n                '}
                    <span>{'Bulanıklık'}</span>
                    {'\n                '}
                    <input
                      id="canvasBackgroundBlur"
                      type="range"
                      min="0"
                      max="20"
                      step="1"
                      defaultValue={'0'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label
                    className="canvas-field canvas-field--range"
                    htmlFor="canvasBackgroundGrain"
                  >
                    {'\n                '}
                    <span>{'Gren'}</span>
                    {'\n                '}
                    <input
                      id="canvasBackgroundGrain"
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      defaultValue={'0'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasComposition">
                    {'\n                '}
                    <span data-i18n="canvas.composition">{'Kompozisyon'}</span>
                    {'\n                '}
                    <select id="canvasComposition">
                      {'\n                  '}
                      <option value={'overlay'} data-i18n="canvas.compOverlay">
                        {'Üst üste'}
                      </option>
                      {'\n                  '}
                      <option value={'below'} data-i18n="canvas.compBelow">
                        {'Alt alta'}
                      </option>
                      {'\n                  '}
                      <option value={'inset'} data-i18n="canvas.compInset">
                        {'İç boşluklu'}
                      </option>
                      {'\n                '}
                    </select>
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasPaddingX">
                    {'\n                '}
                    <span data-i18n="canvas.paddingX">{'Yatay boşluk'}</span>
                    {'\n                '}
                    <input
                      id="canvasPaddingX"
                      type="number"
                      min="0"
                      max="7680"
                      step="1"
                      defaultValue={'0'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasPaddingY">
                    {'\n                '}
                    <span data-i18n="canvas.paddingY">{'Dikey boşluk'}</span>
                    {'\n                '}
                    <input
                      id="canvasPaddingY"
                      type="number"
                      min="0"
                      max="4320"
                      step="1"
                      defaultValue={'0'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasFitMode">
                    {'\n                '}
                    <span data-i18n="canvas.fitMode">{'Görsel sığdırma'}</span>
                    {'\n                '}
                    <select id="canvasFitMode">
                      {'\n                  '}
                      <option value={'fit'} data-i18n="canvas.fitFit">
                        {'Sığdır'}
                      </option>
                      {'\n                  '}
                      <option value={'fill'} data-i18n="canvas.fitFill">
                        {'Doldur'}
                      </option>
                      {'\n                  '}
                      <option value={'stretch'} data-i18n="canvas.fitStretch">
                        {'Esnet'}
                      </option>
                      {'\n                '}
                    </select>
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasWidth">
                    {'\n                '}
                    <span data-i18n="canvas.width">{'Genişlik'}</span>
                    {'\n                '}
                    <input
                      id="canvasWidth"
                      type="number"
                      min="100"
                      max="7680"
                      step="1"
                      defaultValue={'600'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasHeight">
                    {'\n                '}
                    <span data-i18n="canvas.height">{'Yükseklik'}</span>
                    {'\n                '}
                    <input
                      id="canvasHeight"
                      type="number"
                      min="100"
                      max="4320"
                      step="1"
                      defaultValue={'600'}
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-field" htmlFor="canvasExportFormat">
                    {'\n                '}
                    <span data-i18n="canvas.format">{'Biçim'}</span>
                    {'\n                '}
                    <select id="canvasExportFormat">
                      {'\n                  '}
                      <option value={'png'}>{'PNG'}</option>
                      {'\n                  '}
                      <option value={'jpeg'}>{'JPEG'}</option>
                      {'\n                '}
                    </select>
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label
                    className="canvas-field"
                    id="canvasJpegQualityField"
                    htmlFor="canvasJpegQuality"
                    hidden
                  >
                    {'\n                '}
                    <span>{'JPEG kalitesi'}</span>
                    {'\n                '}
                    <select defaultValue={'0.8'} id="canvasJpegQuality">
                      {'\n                  '}
                      <option value={'0.1'}>{'1'}</option>
                      {'\n                  '}
                      <option value={'0.2'}>{'2'}</option>
                      {'\n                  '}
                      <option value={'0.3'}>{'3'}</option>
                      {'\n                  '}
                      <option value={'0.4'}>{'4'}</option>
                      {'\n                  '}
                      <option value={'0.5'}>{'5'}</option>
                      {'\n                  '}
                      <option value={'0.6'}>{'6'}</option>
                      {'\n                  '}
                      <option value={'0.7'}>{'7'}</option>
                      {'\n                  '}
                      <option value={'0.8'}>{'8'}</option>
                      {'\n                  '}
                      <option value={'0.9'}>{'9'}</option>
                      {'\n                  '}
                      <option value={'1'}>{'10'}</option>
                      {'\n                '}
                    </select>
                    {'\n              '}
                  </label>
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="canvas-workspace__body">
                  {'\n              '}
                  <div className="canvas-viewport" id="canvasViewport">
                    {'\n                '}
                    <div className="canvas-stage" id="canvasStage">
                      {'\n                  '}
                      <canvas
                        id="canvasPreview"
                        width="600"
                        height="600"
                        aria-label="Katmanların ve sohbet bloklarının Canvas önizlemesi"
                      >
                        {
                          '\n                    Tarayıcınız Canvas önizlemesini desteklemiyor.\n                  '
                        }
                      </canvas>
                      {'\n                  '}
                      <div id="canvasSelection" className="canvas-selection" hidden>
                        {'\n                    '}
                        <span className="canvas-selection__handle" aria-hidden="true"></span>
                        {'\n                  '}
                      </div>
                      {'\n                  '}
                      <div id="canvasGuides" className="canvas-guides" aria-hidden="true"></div>
                      {'\n                '}
                    </div>
                    {'\n              '}
                  </div>
                  {'\n              '}
                  <aside className="canvas-layers" aria-label="Katmanlar">
                    {'\n                '}
                    <div className="canvas-layers__header">
                      {'\n                  '}
                      <i className="fas fa-layer-group" aria-hidden="true"></i>
                      {'\n                  '}
                      <span data-i18n="canvas.layers">{'Katmanlar'}</span>
                      {'\n                '}
                    </div>
                    {'\n                '}
                    <div id="canvasLayerList" className="canvas-layer-list"></div>
                    {'\n              '}
                  </aside>
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="canvas-statusbar">
                  {'\n              '}
                  <span id="canvasStatus" aria-live="polite">
                    {'600 × 600 px'}
                  </span>
                  {'\n              '}
                  <span id="canvasStatusMeta">{'PNG · %100'}</span>
                  {'\n            '}
                </div>
                {'\n          '}
              </section>
              {'\n\n          '}
              <dialog
                id="canvasChatDialog"
                className="canvas-chat-dialog"
                aria-labelledby="canvasChatTitle"
              >
                {'\n            '}
                <form
                  id="canvasChatForm"
                  className="canvas-chat-dialog__form"
                  method="dialog"
                  noValidate
                >
                  {'\n              '}
                  <div className="canvas-chat-dialog__header">
                    {'\n                '}
                    <h3 id="canvasChatTitle" data-i18n="canvas.dialogTitle">
                      {'Sohbet bloğu ekle'}
                    </h3>
                    {'\n                '}
                    <p data-i18n="canvas.dialogSubtitle">
                      {'Ana sohbetten bağımsız bir ad ve metin girin.'}
                    </p>
                    {'\n              '}
                  </div>
                  {'\n              '}
                  <label className="canvas-chat-dialog__field" htmlFor="canvasChatName">
                    {'\n                '}
                    <span data-i18n="canvas.blockName">{'Blok adı'}</span>
                    {'\n                '}
                    <input
                      id="canvasChatName"
                      name="canvasChatName"
                      type="text"
                      maxLength={80}
                      required
                      aria-describedby="canvasChatError"
                      autoComplete="off"
                      placeholder="Örn. Yan sohbet"
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <label className="canvas-chat-dialog__field" htmlFor="canvasChatInput">
                    {'\n                '}
                    <span data-i18n="canvas.chatText">{'Sohbet metni'}</span>
                    {'\n                '}
                    <textarea
                      id="canvasChatInput"
                      name="canvasChatInput"
                      rows={9}
                      required
                      aria-describedby="canvasChatError"
                      placeholder="Chatlog satırlarını buraya yapıştırın"
                    />
                    {'\n              '}
                  </label>
                  {'\n              '}
                  <p
                    id="canvasChatError"
                    className="canvas-chat-dialog__error"
                    role="status"
                    aria-live="polite"
                  ></p>
                  {'\n              '}
                  <div className="canvas-chat-dialog__actions">
                    {'\n                '}
                    <button
                      id="canvasChatCancel"
                      className="canvas-command"
                      type="button"
                      data-i18n="ui.cancel"
                    >
                      {'İptal'}
                    </button>
                    {'\n                '}
                    <button
                      id="canvasChatSubmit"
                      className="canvas-command canvas-chat-dialog__submit"
                      type="submit"
                      data-i18n="canvas.addChat"
                    >
                      {'\n                  Sohbet bloğunu ekle\n                '}
                    </button>
                    {'\n              '}
                  </div>
                  {'\n            '}
                </form>
                {'\n          '}
              </dialog>
            </div>
            {'\n      '}
          </div>
          {'\n    '}
        </div>
        {'\n  '}
      </main>
      {'\n\n  '}
      <section
        id="communityModal"
        className="community-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="communityTitle"
        hidden
      >
        {'\n    '}
        <button
          id="communityBackdrop"
          className="community-modal__backdrop"
          type="button"
          tabIndex={-1}
          aria-label="Topluluk presetlerini kapat"
        ></button>
        {'\n    '}
        <div className="community-modal__panel">
          {'\n      '}
          <header className="community-modal__header">
            {'\n        '}
            <div>
              {'\n          '}
              <h2 id="communityTitle" data-i18n="presets.title">
                {'Presetler'}
              </h2>
              {'\n        '}
            </div>
            {'\n        '}
            <button
              id="communityClose"
              className="community-icon-button"
              type="button"
              title="Kapat"
              aria-label="Kapat"
              data-i18n-title="ui.close"
              data-i18n-aria-label="ui.close"
            >
              {'\n          '}
              <i className="fas fa-xmark" aria-hidden="true"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </header>
          {'\n\n      '}
          <form id="communitySearchForm" className="community-search" role="search">
            {'\n        '}
            <label className="visually-hidden" htmlFor="communitySearchInput">
              {'Preset ara'}
            </label>
            {'\n        '}
            <i className="fas fa-magnifying-glass" aria-hidden="true"></i>
            {'\n        '}
            <input
              id="communitySearchInput"
              type="search"
              maxLength={80}
              autoComplete="off"
              placeholder="Başlığa göre ara"
              data-i18n-placeholder="presets.searchPlaceholder"
            />
            {'\n        '}
            <button
              className="community-icon-button"
              type="submit"
              title="Ara"
              aria-label="Preset ara"
            >
              {'\n          '}
              <i className="fas fa-arrow-right" aria-hidden="true"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </form>
          {'\n\n      '}
          <div className="community-import-row">
            {'\n        '}
            <button id="communityImportBtn" className="community-import-btn" type="button">
              {'\n          '}
              <i className="fas fa-file-import" aria-hidden="true"></i>
              {'\n          '}
              <span data-i18n="presets.importFile">{'Dosyadan İçe Aktar'}</span>
              {'\n        '}
            </button>
            {'\n        '}
            <button id="communityPasteBtn" className="community-import-btn" type="button">
              {'\n          '}
              <i className="fas fa-paste" aria-hidden="true"></i>
              {'\n          '}
              <span data-i18n="presets.pasteClipboard">{'Panodan Yapıştır'}</span>
              {'\n        '}
            </button>
            {'\n        '}
            <input id="communityImportFile" type="file" accept=".json,application/json" hidden />
            {'\n        '}
            <small className="community-import-hint" data-i18n="presets.importHint">
              {'JSON dosyası seçin veya kopyaladığınız preset kodunu yapıştırın'}
            </small>
            {'\n      '}
          </div>
          {'\n\n      '}
          <p id="communityStatus" className="community-status" role="status" aria-live="polite"></p>
          {'\n\n      '}
          <div className="community-modal__body">
            {'\n        '}
            <div className="community-gallery">
              {'\n          '}
              <div
                id="communityGrid"
                className="community-grid"
                aria-label="Topluluk presetleri"
              ></div>
              {'\n          '}
              <button
                id="communityLoadMore"
                className="community-load-more"
                type="button"
                data-i18n="presets.loadMore"
                hidden
              >
                {'\n            Daha fazla göster\n          '}
              </button>
              {'\n        '}
            </div>
            {'\n\n        '}
            <aside
              id="communityPreview"
              className="community-preview"
              aria-labelledby="communityPreviewTitle"
              hidden
            >
              {'\n          '}
              <div className="community-preview__media">
                {'\n            '}
                <img id="communityPreviewImage" alt="" decoding="async" />
                {'\n            '}
                <div
                  id="communityPreviewFallback"
                  className="community-preview__fallback"
                  data-i18n="presets.fallbackPreview"
                  hidden
                >
                  {'\n              Önizleme kullanılamıyor\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n          '}
              <h3 id="communityPreviewTitle"></h3>
              {'\n          '}
              <p id="communityPreviewDescription"></p>
              {'\n          '}
              <button id="communityPreviewApply" className="community-primary" type="button">
                {'\n            '}
                <i className="fas fa-wand-magic-sparkles" aria-hidden="true"></i>
                {'\n            '}
                <span data-i18n="presets.apply">{'Uygula'}</span>
                {'\n          '}
              </button>
              {'\n        '}
            </aside>
            {'\n      '}
          </div>
          {'\n\n      '}
          <form id="communitySubmitForm" className="community-submit">
            {'\n        '}
            <div className="community-submit__heading">
              {'\n          '}
              <div>
                {'\n            '}
                <h3 data-i18n="presets.saveHeading">{'Mevcut Görünümü Kaydet'}</h3>
                {'\n            '}
                <p data-i18n="presets.saveSubheading">
                  {'Yazı tipi, boyut, aralık ve canvas ayarları yerel preset olarak saklanır.'}
                </p>
                {'\n          '}
              </div>
              {'\n        '}
            </div>
            {'\n        '}
            <div className="community-submit__fields">
              {'\n          '}
              <div className="community-submit__group community-submit__group--title">
                {'\n            '}
                <label htmlFor="communityPresetTitle" data-i18n="presets.fieldTitle">
                  {'Başlık'}
                </label>
                {'\n            '}
                <input
                  id="communityPresetTitle"
                  type="text"
                  maxLength={60}
                  required
                  autoComplete="off"
                />
                {'\n          '}
              </div>
              {'\n          '}
              <div className="community-submit__group community-submit__group--desc">
                {'\n            '}
                <label htmlFor="communityPresetDescription">
                  <span data-i18n="presets.fieldDesc">{'Açıklama'}</span>{' '}
                  <span className="community-submit__optional" data-i18n="presets.optional">
                    {'(İsteğe bağlı)'}
                  </span>
                </label>
                {'\n            '}
                <input
                  id="communityPresetDescription"
                  type="text"
                  maxLength={240}
                  autoComplete="off"
                />
                {'\n          '}
              </div>
              {'\n          '}
              <button
                id="communitySubmit"
                className="community-primary community-submit__btn"
                type="submit"
              >
                {'\n            '}
                <i className="fas fa-floppy-disk" aria-hidden="true"></i>
                {'\n            '}
                <span data-i18n="ui.savePreset">{'Preseti Kaydet'}</span>
                {'\n          '}
              </button>
              {'\n        '}
            </div>
            {'\n      '}
          </form>
          {'\n    '}
        </div>
        {'\n  '}
      </section>
      {'\n\n  '}
      {/* Third-party scripts with fallback handling */}
      {'\n  \n  \n  \n  \n\n  '}
      {/* Application scripts */}
      {'\n  \n  \n  \n  \n  \n  \n  \n  \n  \n  \n  \n  \n  \n  \n  \n\n  '}
      {/* History panel */}
      {'\n  '}
      <div
        className="history-tab"
        role="button"
        tabIndex={0}
        aria-label="Open chat history"
        aria-expanded="false"
        aria-controls="historyPanel"
      >
        {'\n    '}
        <i className="fas fa-clock-rotate-left" aria-hidden="true"></i>
        {'\n  '}
      </div>
      {'\n\n  '}
      <div
        id="historyPanel"
        className="history-panel"
        role="dialog"
        aria-label="Chat history"
        aria-hidden="true"
      >
        {'\n    '}
        <div className="history-header">
          {'\n      '}
          <div className="history-header-title">
            {'\n        '}
            <i className="fas fa-clock-rotate-left" aria-hidden="true"></i>
            {'\n        '}
            <h3 data-i18n="history.title">{'Sohbet Kaydı Geçmişi'}</h3>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="history-header-actions">
            {'\n        '}
            <button
              id="clearHistoryBtn"
              className="clear-history-btn"
              aria-label="Clear all history"
              data-i18n="history.clearAll"
            >
              {'Tümünü Temizle'}
            </button>
            {'\n        '}
            <button
              id="closeHistoryBtn"
              className="history-close-btn"
              type="button"
              aria-label="Geçmişi kapat"
              title="Kapat"
              data-i18n-title="ui.close"
              data-i18n-aria-label="ui.close"
            >
              {'\n          '}
              <i className="fas fa-xmark" aria-hidden="true"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n    '}
        </div>
        {'\n    '}
        <div className="history-items" role="list"></div>
        {'\n    '}
        <div className="history-loading">
          {'\n      '}
          <div className="spinner" aria-hidden="true"></div>
          {'\n      '}
          <p data-i18n="history.loading">{'Sohbet kaydı geçmişiniz yükleniyor...'}</p>
          {'\n    '}
        </div>
        {'\n\n  '}
      </div>
      {'\n\n  '}
      {/* Color Palette */}
      {'\n  '}
      <div id="colorPalette" className="color-palette" style={{ display: 'none' }}>
        {'\n    '}
        <div className="color-palette-header">
          {'\n      '}
          <div className="color-palette-title">
            {'\n        '}
            <span data-i18n="colorPalette.title">{'Renk Seç'}</span>
            {'\n        '}
            <span className="selection-counter">{'0 seçildi'}</span>
            {'\n      '}
          </div>
          {'\n      '}
          <button
            id="closeColorPaletteBtn"
            className="color-palette-close"
            type="button"
            aria-label="Kapat"
            title="Kapat"
            data-i18n-title="ui.close"
            data-i18n-aria-label="ui.close"
          >
            {'\n        '}
            <i className="fas fa-xmark" aria-hidden="true"></i>
            {'\n      '}
          </button>
          {'\n    '}
        </div>
        {'\n    '}
        <div className="color-palette-items">
          {'\n      '}
          <div className="color-item me" data-color="me" data-tooltip="Aksiyon (/me, /ame)"></div>
          {'\n      '}
          <div className="color-item ame" data-color="ame" data-tooltip="Aksiyon (/ame)"></div>
          {'\n      '}
          <div
            className="color-item darkgrey"
            data-color="darkgrey"
            data-tooltip="Alçak Ses (/low)"
          ></div>
          {'\n      '}
          <div className="color-item grey" data-color="grey" data-tooltip="Kısık Ses"></div>
          {'\n      '}
          <div
            className="color-item lightgrey"
            data-color="lightgrey"
            data-tooltip="Normal Yazı (Diğer Oyuncu)"
          ></div>
          {'\n      '}
          <div
            className="color-item death"
            data-color="death"
            data-tooltip="Ölüm/Başarısızlık"
          ></div>
          {'\n      '}
          <div
            className="color-item yellow"
            data-color="yellow"
            data-tooltip="Önemli Bilgi / Telefon"
          ></div>
          {'\n      '}
          <div className="color-item green" data-color="green" data-tooltip="Başarılı"></div>
          {'\n      '}
          <div className="color-item orange" data-color="orange" data-tooltip="Uyarı"></div>
          {'\n      '}
          <div className="color-item blue" data-color="blue" data-tooltip="Bilgi"></div>
          {'\n      '}
          <div
            className="color-item dodgerblue"
            data-color="dodgerblue"
            data-tooltip="İstemci Bilgisi (DodgerBlue)"
          ></div>
          {'\n      '}
          <div
            className="color-item white"
            data-color="white"
            data-tooltip="Normal Mesaj (Senin Mesajın)"
          ></div>
          {'\n      '}
          <div
            className="color-item radioColor"
            data-color="radioColor"
            data-tooltip="Telsiz /r (Senin Kanalın)"
          ></div>
          {'\n      '}
          <div
            className="color-item radioColor2"
            data-color="radioColor2"
            data-tooltip="Telsiz /rc (Diğer Kanal)"
          ></div>
          {'\n      '}
          <div className="color-item depColor" data-color="depColor" data-tooltip="Departman"></div>
          {'\n      '}
          <div
            className="color-item vessels-traffic"
            data-color="vesseltraffic"
            data-tooltip="Deniz Trafiği"
          ></div>
          {'\n      '}
          <div
            className="color-item toyou"
            data-color="toyou"
            data-tooltip="Sana Yönelik [!]"
          ></div>
          {'\n      '}
          <div className="color-item new" data-color="new" data-tooltip="Yeni"></div>
          {'\n    '}
        </div>
        {'\n    '}
        <div className="color-palette-footer">
          {'\n      '}
          <i
            className="fas fa-mouse-pointer"
            style={{ marginRight: '4px', opacity: '0.6' }}
          ></i>{' '}
          <span data-i18n="colorPalette.hint">
            {'Kelimeleri farenizle seçin, ardından yukarıdan renk atayın.'}
          </span>
          {'\n    '}
        </div>
        {'\n  '}
      </div>
      {'\n\n  '}
      {/* Filter Modal - Gelişmiş Sohbet Filtresi & Karakter Çıkarma */}
      {'\n  '}
      <div
        id="filterModal"
        className="help-modal filter-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filterModalTitle"
        style={{ display: 'none' }}
      >
        {'\n    '}
        <div className="help-modal-backdrop" id="filterModalBackdrop"></div>
        {'\n    '}
        <div className="help-modal-content filter-modal-content" style={{ maxWidth: '620px' }}>
          {'\n      '}
          <div className="help-modal-header">
            {'\n        '}
            <h2 id="filterModalTitle">
              <i className="fas fa-filter"></i> <span>{'Sohbet Filtresi'}</span>
            </h2>
            {'\n        '}
            <button
              type="button"
              id="closeFilterModal"
              className="help-modal-close"
              aria-label="Filtreyi kapat"
            >
              {'\n          '}
              <i className="fas fa-times"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n\n      '}
          <div className="help-modal-body" style={{ padding: '16px' }}>
            {'\n        '}
            <p style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>
              {
                '\n          Gereksiz satırları kategorilerine göre gizleyin veya istemediğiniz karakterlerin repliklerini tek tıkla çıkarın.\n        '
              }
            </p>
            {'\n\n        '}
            {/* Kategori Filtreleri */}
            {'\n        '}
            <h3
              style={{
                fontSize: '13.5px',
                fontWeight: '600',
                color: '#f1f5f9',
                marginBottom: '10px',
              }}
            >
              {'\n          '}
              <i className="fas fa-tags" style={{ color: '#38bdf8' }}></i>
              {' Kategori Filtreleri\n        '}
            </h3>
            {'\n        '}
            <div
              className="filter-categories-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '10px',
                marginBottom: '20px',
              }}
            >
              {'\n          '}
              <label
                className="filter-category-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                }}
              >
                {'\n            '}
                <input type="checkbox" id="filterOoc" defaultChecked />
                {'\n            '}
                <span>
                  {'OOC / PM ('}
                  <span id="countOoc">{'0'}</span>
                  {')'}
                </span>
                {'\n          '}
              </label>
              {'\n          '}
              <label
                className="filter-category-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                }}
              >
                {'\n            '}
                <input type="checkbox" id="filterRadio" defaultChecked />
                {'\n            '}
                <span>
                  {'Telsiz / Departman ('}
                  <span id="countRadio">{'0'}</span>
                  {')'}
                </span>
                {'\n          '}
              </label>
              {'\n          '}
              <label
                className="filter-category-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                }}
              >
                {'\n            '}
                <input type="checkbox" id="filterAds" defaultChecked />
                {'\n            '}
                <span>
                  {'Reklamlar ('}
                  <span id="countAds">{'0'}</span>
                  {')'}
                </span>
                {'\n          '}
              </label>
              {'\n          '}
              <label
                className="filter-category-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                }}
              >
                {'\n            '}
                <input type="checkbox" id="filterPhone" defaultChecked />
                {'\n            '}
                <span>
                  {'Telefon & SMS ('}
                  <span id="countPhone">{'0'}</span>
                  {')'}
                </span>
                {'\n          '}
              </label>
              {'\n          '}
              <label
                className="filter-category-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                }}
              >
                {'\n            '}
                <input type="checkbox" id="filterTransactions" defaultChecked />
                {'\n            '}
                <span>
                  {'Para & İşlemler ('}
                  <span id="countTransactions">{'0'}</span>
                  {')'}
                </span>
                {'\n          '}
              </label>
              {'\n          '}
              <label
                className="filter-category-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  color: '#e0e0e0',
                  cursor: 'pointer',
                }}
              >
                {'\n            '}
                <input type="checkbox" id="filterSystem" defaultChecked />
                {'\n            '}
                <span>
                  {'Sistem Mesajları ('}
                  <span id="countSystem">{'0'}</span>
                  {')'}
                </span>
                {'\n          '}
              </label>
              {'\n        '}
            </div>
            {'\n\n        '}
            {/* Konuşmacı Listesi (Speaker Drop) */}
            {'\n        '}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '10px',
              }}
            >
              {'\n          '}
              <h3 style={{ fontSize: '13.5px', fontWeight: '600', color: '#f1f5f9', margin: '0' }}>
                {'\n            '}
                <i className="fas fa-users" style={{ color: '#4ade80' }}></i>
                {' Konuşmacılar (Karakter Çıkar)\n          '}
              </h3>
              {'\n          '}
              <span id="speakerSummary" style={{ fontSize: '12px', color: '#94a3b8' }}>
                {'0 konuşmacı bulundu'}
              </span>
              {'\n        '}
            </div>
            {'\n        '}
            <div
              id="filterSpeakerList"
              className="filter-speaker-list"
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px',
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
              }}
            >
              {'\n          '}
              <p
                style={{ color: '#64748b', fontSize: '12px', margin: '8px 0', textAlign: 'center' }}
              >
                {'Konuşmacı bulunamadı veya henüz log girilmedi.'}
              </p>
              {'\n        '}
            </div>
            {'\n\n        '}
            <div
              className="filter-modal-actions"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '20px',
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: '14px',
              }}
            >
              {'\n          '}
              <button
                type="button"
                id="filterResetAllBtn"
                className="button secondary small"
                style={{ margin: '0' }}
              >
                {'Tümünü Seç / Sıfırla'}
              </button>
              {'\n          '}
              <div style={{ display: 'flex', gap: '8px' }}>
                {'\n            '}
                <button
                  type="button"
                  id="cancelFilterBtn"
                  className="button secondary small"
                  style={{ margin: '0' }}
                >
                  {'İptal'}
                </button>
                {'\n            '}
                <button
                  type="button"
                  id="applyFilterModalBtn"
                  className="button success small"
                  style={{ margin: '0' }}
                >
                  <i className="fas fa-check"></i>
                  {' Filtreyi Uygula'}
                </button>
                {'\n          '}
              </div>
              {'\n        '}
            </div>
            {'\n      '}
          </div>
          {'\n    '}
        </div>
        {'\n  '}
      </div>
      {'\n\n  '}
      {/* Features/Tips Modal */}
      {'\n  '}
      <div
        id="featuresModal"
        style={{
          display: 'none',
          position: 'fixed',
          inset: '0',
          zIndex: '10000',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {'\n\n    '}
        {/* Backdrop */}
        {'\n    '}
        <div
          id="featuresBackdrop"
          style={{
            position: 'absolute',
            inset: '0',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
          }}
        ></div>
        {'\n\n    '}
        {/* Modal */}
        {'\n    '}
        <div
          style={{
            maxWidth: '760px',
            width: '92%',
            background: '#1b1f27',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '14px',
            position: 'relative',
            zIndex: '10002',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          {'\n\n      '}
          {/* Header */}
          {'\n      '}
          <div
            style={{
              padding: '18px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {'\n        '}
            <h2
              style={{
                margin: '0',
                fontSize: '17px',
                color: '#f1f1f1',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {'\n          '}
              <i className="fas fa-lightbulb" style={{ color: '#f1c40f', marginRight: '8px' }}></i>
              {'\n          Tüm Özellikler ve İpuçları\n        '}
            </h2>
            {'\n\n        '}
            <button
              id="closeFeaturesModal"
              style={{
                background: 'none',
                border: 'none',
                color: '#888',
                cursor: 'pointer',
                fontSize: '18px',
              }}
            >
              {'\n          '}
              <i className="fas fa-times"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n\n      '}
          {/* Body */}
          {'\n      '}
          <div style={{ padding: '20px', maxHeight: '65vh', overflowY: 'auto' }}>
            {'\n\n        '}
            {/* ─── CARD GRID (2 sütun) ─── */}
            {'\n        '}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '20px',
              }}
            >
              {'\n\n          '}
              {/* CARD 1: Chatlog Renklendirme */}
              {'\n          '}
              <div
                className="legacy-hover-card"
                style={{
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                  transition: 'background 0.18s',
                }}
              >
                {'\n            '}
                <video
                  src="assets/videos/renk.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: '100%', height: '155px', objectFit: 'cover', display: 'block' }}
                ></video>
                {'\n            '}
                <div style={{ padding: '11px 14px 13px' }}>
                  {'\n              '}
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13.5px',
                      color: '#fff',
                      fontWeight: '600',
                    }}
                  >
                    {'Chatlog Renklendirme'}
                  </h3>
                  {'\n              '}
                  <p
                    style={{ margin: '0', fontSize: '12px', color: '#a8a8a8', lineHeight: '1.55' }}
                  >
                    {
                      '\n                Sohbet modunda bir kelimeye tıklayarak rengini değiştirebilirsiniz.\n                Çoklu seçim için '
                    }
                    <strong style={{ color: '#ccc' }}>{'CTRL + tıklama'}</strong>
                    {' veya sürükleme.\n              '}
                  </p>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n\n          '}
              {/* CARD 2: Karakter Adı Vurgulama */}
              {'\n          '}
              <div
                className="legacy-hover-card"
                style={{
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                  transition: 'background 0.18s',
                }}
              >
                {'\n            '}
                <video
                  src="assets/videos/karakter.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: '100%', height: '155px', objectFit: 'cover', display: 'block' }}
                ></video>
                {'\n            '}
                <div style={{ padding: '11px 14px 13px' }}>
                  {'\n              '}
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13.5px',
                      color: '#fff',
                      fontWeight: '600',
                    }}
                  >
                    {'Karakter Adı Vurgulama\n              '}
                  </h3>
                  {'\n              '}
                  <p
                    style={{ margin: '0', fontSize: '12px', color: '#a8a8a8', lineHeight: '1.55' }}
                  >
                    {
                      '\n                Karakter adınızı girerek size gelen mesajların farklı renkte vurgulanmasını sağlayabilirsiniz.\n              '
                    }
                  </p>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n\n          '}
              {/* CARD 3: Sansür Kullanımı */}
              {'\n          '}
              <div
                className="legacy-hover-card"
                style={{
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                  transition: 'background 0.18s',
                }}
              >
                {'\n            '}
                <video
                  src="assets/videos/sansur.webm"
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{ width: '100%', height: '155px', objectFit: 'cover', display: 'block' }}
                ></video>
                {'\n            '}
                <div style={{ padding: '11px 14px 13px' }}>
                  {'\n              '}
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13.5px',
                      color: '#fff',
                      fontWeight: '600',
                    }}
                  >
                    {'Sansür Kullanımı'}
                  </h3>
                  {'\n              '}
                  <p
                    style={{ margin: '0', fontSize: '12px', color: '#a8a8a8', lineHeight: '1.55' }}
                  >
                    {'\n                Metnin başına ve sonuna '}
                    <strong style={{ color: '#ccc' }}>{'÷'}</strong>
                    {
                      ' koyarak sansür uygulayabilirsiniz.\n                Modu üstteki butonlardan değiştirebilirsiniz.\n              '
                    }
                  </p>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n\n          '}
              {/* CARD 4: Hızlı Metin Formatlama */}
              {'\n          '}
              <div
                className="legacy-hover-card"
                style={{
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  overflow: 'hidden',
                  transition: 'background 0.18s',
                }}
              >
                {'\n            '}
                <img
                  src="assets/images/image.png"
                  style={{ width: '100%', height: '155px', objectFit: 'cover', display: 'block' }}
                />
                {'\n            '}
                <div style={{ padding: '11px 14px 13px' }}>
                  {'\n              '}
                  <h3
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '13.5px',
                      color: '#fff',
                      fontWeight: '600',
                    }}
                  >
                    {'Hızlı Metin Formatlama\n              '}
                  </h3>
                  {'\n              '}
                  <p
                    style={{ margin: '0', fontSize: '12px', color: '#a8a8a8', lineHeight: '1.55' }}
                  >
                    {'\n                '}
                    <strong style={{ color: '#ccc' }}>{'*Metin*'}</strong>
                    {' → ame/me rengi'}
                    <br />
                    {'\n                '}
                    <strong style={{ color: '#ccc' }}>{'/Metin/'}</strong>
                    {' → italik (isteğe bağlı)\n              '}
                  </p>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n\n        '}
            </div>
            {'\n        '}
            {/* ─── /CARD GRID ─── */}
            {'\n\n        '}
            {/* Divider */}
            {'\n        '}
            <div
              style={{
                margin: '4px 0 14px 0',
                fontSize: '11px',
                fontWeight: '600',
                color: 'rgba(255,255,255,0.3)',
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                paddingBottom: '8px',
              }}
            >
              {'\n          Sohbet Modu Ayarları\n        '}
            </div>
            {'\n\n        '}
            {/* Chat settings list */}
            {'\n        '}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-user-tag"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'İsimler'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {
                    'Karakter adını girdiğinizde size\n              yönelik mesajlar farklı renkte vurgulanır. Butonu kapatırsanız tüm isimler standart renge döner.'
                  }
                </span>
                {'\n          '}
              </div>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-fill-drip"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'Renk Paleti'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {
                    'Çıktıdaki bir kelimeye tıklayarak\n              renk atayabilirsiniz. Birden fazla seçim için '
                  }
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {'Ctrl +\n                tıklama'}
                  </strong>
                  {' veya sürükleme kullanın. Sağ tık ile de renk menüsüne ulaşabilirsiniz.'}
                </span>
                {'\n          '}
              </div>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-shield-halved"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'Sansür'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {'Gizlemek istediğiniz metnin\n              başına ve sonuna '}
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{'÷'}</strong>
                  {
                    ' karakterini koyun. Sansür stilini\n              (bulanık ve kaldır) üstteki butondan değiştirebilirsiniz. ÷ karakterini kopyalamak için yanındaki butona\n              basın.'
                  }
                </span>
                {'\n          '}
              </div>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-italic"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'İtalik & Emote Boyama'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {'Metinde '}
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{'*yıldız*'}</strong>
                  {' ile sarılmış kısımlar otomatik olarak\n              '}
                  <em>{'ame/me'}</em>
                  {' renginde görünür. '}
                  <strong style={{ color: 'rgba(255,255,255,0.7)' }}>{'/eğik çizgi/'}</strong>
                  {' ile\n              de '}
                  <em>{'italik'}</em>
                  {' efekti alabilirsiniz.'}
                </span>
                {'\n          '}
              </div>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-font"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'Font'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {
                    'Çıktının yazı tipini değiştirin.\n              Farklı fontlar farklı bir his yaratır; GTAW içi görünüme en yakın sonuç için Arial önerilir.'
                  }
                </span>
                {'\n          '}
              </div>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-circle-half-stroke"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'Kontrast'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {
                    'Yazının arka planına hafif bir\n              karartma ekler; koyu veya karmaşık görsellerin üstünde metni daha okunabilir kılar.'
                  }
                </span>
                {'\n          '}
              </div>
              {'\n\n          '}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '140px 1fr',
                  gap: '10px 16px',
                  padding: '10px 0',
                  alignItems: 'start',
                }}
              >
                {'\n            '}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {'\n              '}
                  <i
                    className="fas fa-square-check"
                    style={{
                      fontSize: '11px',
                      color: 'rgba(255,255,255,0.25)',
                      width: '14px',
                      textAlign: 'center',
                    }}
                  ></i>
                  {'\n              '}
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#e0e0e0' }}>
                    {'Arka Plan'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <span
                  style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: '1.55' }}
                >
                  {
                    "Çıktının arkasına siyah bir\n              görüntü ekler. Chatlog'u bir görselin üstüne yerleştirirken okunabilirliği artırır."
                  }
                </span>
                {'\n          '}
              </div>
              {'\n\n        '}
            </div>
            {'\n\n      '}
          </div>
          {'\n\n      '}
          {/* Footer */}
          {'\n      '}
          <div
            style={{
              padding: '14px',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            {'\n        '}
            <button
              id="closeFeaturesBtn"
              style={{
                padding: '10px 18px',
                background: '#f1c40f',
                border: 'none',
                color: '#1a1a1a',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600',
              }}
              data-i18n="features.gotIt"
            >
              {'\n          Anladım\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n\n    '}
        </div>
        {'\n  '}
      </div>
      {'\n\n  '}
      {/* Floating Changelog Tab */}
      {'\n  '}
      {/* <button type="button" class="changelog-tab" id="openChangelogBtn" aria-label="Yama notlarını aç"
    aria-controls="changelogDrawer" aria-expanded="false">
    <i class="fas fa-bullhorn" aria-hidden="true"></i>
    <span id="changelogBadge"
      style="position:absolute;top:-3px;right:-3px;width:9px;height:9px;border-radius:50%;background:#e74c3c;border:2px solid #1b1f27;display:none;"></span>
  </button> */}
      {'\n\n  '}
      {/* Compact latest-update popover */}
      {'\n  '}
      <div
        id="changelogDrawer"
        className="changelog-popover"
        role="region"
        aria-labelledby="changelogTitle"
      >
        {'\n    '}
        <div
          style={{
            padding: '25px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {'\n      '}
          <h2
            id="changelogTitle"
            style={{
              margin: '0',
              fontSize: '16px',
              color: '#f1f1f1',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {'\n        '}
            <i
              className="fas fa-history"
              aria-hidden="true"
              style={{ marginRight: '10px', color: '#2ecc71' }}
            ></i>
            {'\n        '}
            <span data-i18n="changelog.title">{'Güncelleme Notları'}</span>{' '}
            <span
              style={{
                background: 'rgba(46,204,113,0.1)',
                color: '#2ecc71',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '11px',
                marginLeft: '10px',
              }}
            >
              {'v2.1.2'}
            </span>
            {'\n      '}
          </h2>
          {'\n      '}
          <button
            type="button"
            id="closeChangelogModal"
            data-i18n-aria-label="changelog.close"
            aria-label="Kapat"
            style={{
              background: 'none',
              border: 'none',
              color: '#aaa',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '5px',
            }}
          >
            {'\n        '}
            <i className="fas fa-times" aria-hidden="true"></i>
            {'\n      '}
          </button>
          {'\n    '}
        </div>
        {'\n    '}
        <div style={{ padding: '25px', overflowY: 'auto', flex: '1' }}>
          {'\n      '}
          <style>
            {
              "\n        .cl-entry {\n          position: relative;\n          padding-left: 28px;\n          margin-bottom: 28px;\n        }\n\n        .cl-entry::before {\n          content: '';\n          position: absolute;\n          left: 6px;\n          top: 22px;\n          bottom: -12px;\n          width: 1px;\n          background: rgba(255, 255, 255, 0.06);\n        }\n\n        .cl-entry:last-child::before {\n          display: none;\n        }\n\n        .cl-dot {\n          position: absolute;\n          left: 0;\n          top: 4px;\n          width: 13px;\n          height: 13px;\n          border-radius: 50%;\n          border: 2px solid;\n        }\n\n        .cl-dot-latest {\n          background: #2ecc71;\n          border-color: #2ecc71;\n          box-shadow: 0 0 6px rgba(46, 204, 113, 0.4);\n        }\n\n        .cl-dot-old {\n          background: #1b1f27;\n          border-color: rgba(255, 255, 255, 0.15);\n        }\n\n        .cl-title-latest {\n          color: #2ecc71;\n          font-size: 12px;\n          margin: 0 0 10px 0;\n          font-weight: 600;\n          letter-spacing: 0.3px;\n        }\n\n        .cl-title-old {\n          color: rgba(255, 255, 255, 0.35);\n          font-size: 12px;\n          margin: 0 0 10px 0;\n          font-weight: 600;\n          letter-spacing: 0.3px;\n        }\n\n        .cl-list {\n          margin: 0;\n          padding-left: 16px;\n          line-height: 1.7;\n          color: rgba(255, 255, 255, 0.55);\n          font-size: 13px;\n          display: flex;\n          flex-direction: column;\n          gap: 6px;\n        }\n\n        .cl-list-latest {\n          color: rgba(255, 255, 255, 0.75);\n        }\n      "
            }
          </style>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-latest"></div>
            {'\n        '}
            <h3 className="cl-title-latest">
              {'v2.1.2 — '}
              <span data-i18n="changelog.v2_1_0.date">{'2 Ekim 2026'}</span>
            </h3>
            {'\n        '}
            <ul className="cl-list cl-list-latest">
              {'\n          '}
              <li data-i18n="changelog.v2_1_2.item1">
                {'Siyah arkaplanın gereğinden fazla uzama problemi çözüldü.'}
              </li>
              {'\n          '}
              <li data-i18n="changelog.v2_1_2.item2">{'İyileştirmeler ve eklemeler.'}</li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-latest"></div>
            {'\n        '}
            <h3 className="cl-title-latest">
              {'v2.1.1 — '}
              <span data-i18n="changelog.v2_1_0.date">{'10 Eylül 2026'}</span>
            </h3>
            {'\n        '}
            <ul className="cl-list cl-list-latest">
              {'\n          '}
              <li data-i18n="changelog.v2_1_0.item1">
                {'Geri bildirim rate-limit düzeltmesi: kişi başı sınır artık doğru uygulanıyor.'}
              </li>
              {'\n          '}
              <li data-i18n="changelog.v2_1_0.item2">
                {
                  'Arayüz mesajları (gönderiliyor, gönderildi, hata) artık seçili dilde gösteriliyor.'
                }
              </li>
              {'\n          '}
              <li data-i18n="changelog.v2_1_0.item3">
                {'Dil seçicisine "Otomatik (Tarayıcı)" seçeneği eklendi.'}
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">
              {'v2.1.0 — Modern Modal Mimarisi & Preset İyileştirmeleri'}
            </h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'Tarayıcının yerel confirm pencereleri yerine modern, koyu temalı onay ve karar modalları entegre edildi; modalların dışına (arka plana) tıklayarak kapatabilme desteği eklendi.'
                }
              </li>
              {'\n          '}
              <li>
                {'Topluluk preset kartları yeniden tasarlandı: '}
                <strong>{'Uygula'}</strong>
                {
                  ' butonu tam genişlikte öne çıkarılırken ikincil işlemler (Paylaş, İndir, Sil) düzenli bir alt sıraya yerleştirildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Fareyle butonlara tıklandıktan sonra beliren parlak beyaz odaklama halkası (focus ring) kaldırıldı.'
                }
              </li>
              {'\n          '}
              <li>{'Proje durum bildirimleri tekil toast popup akışına bağlandı.'}</li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v2.0.2 — Metin Seçimi & Canlı Renk Modu'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'Çıktı alanında fare ile seçilen metin aralıkları, renk moduna geçişte doğrudan korunacak ve senkronize çalışacak şekilde uyarlandı.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Kontrast butonu indirme alanının hemen yanına taşınarak tek tıkla erişilebilir kılındı; sistem mesajları kontrolü kompakt hale getirildi.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v2.0.1 — Kompakt Arayüz & Toolbar Optimizasyonları'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'Karakter adı ve ayar kutucuklarının görsel orantıları dengelendi; Canvas ve preset modalı form girdilerindeki beyaz parlama etkisi giderildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  "Preset modalı arama kutusu ve etiket placeholder'ları karanlık temaya tam uyumlu hale getirildi."
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v2.0.0 — Canvas Modu Açıldı'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {'Arka plan, görsel katmanları ve birden fazla sohbet bloğu için yeni '}
                <strong>{'Canvas modu'}</strong>
                {' kullanıma açıldı.'}
              </li>
              {'\n          '}
              <li>
                {
                  'Katman taşıma, boyutlandırma, sıralama, kilitleme, opaklık, geri alma ve PNG/JPEG dışa aktarma eklendi.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.4.4 — Arka Plan Modu Hata Düzeltmesi'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                <strong>{'Arka Plan: Açık'}</strong>
                {
                  ' modunda satırların arasındaki siyah arka planda görünen ufak\n            beyaz boşluklar giderildi. Yüksek satır aralıklarında dahi arka plan tek parça halinde görünüyor.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Varsayılan satır aralığı değeri eski haline (1.3) geri çekildi. Daha önce ayar yapmış olanların\n            seçimi korunur.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">
              {'v1.4.3 — Otomatik İsim Algılama & Arayüz İyileştirmesi'}
            </h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {'İsim ve eylemin bitişik yazıldığı satırlar (örn. '}
                <em>{'> John Doegülümser'}</em>
                {
                  ') artık sadece kendi\n            karakter adınızda değil, sahnedeki diğer kişilerin satırlarında da otomatik düzeltiliyor. Sistem\n            chatlog içinde geçen tüm isimleri kendiliğinden tanıyor.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Tanınmayan bir isim için sistem yanlış yerden bölme yapmaktansa satırı olduğu gibi bırakır;\n            karakter adını kayıt listesine eklemek bu durumda yeterlidir.'
                }
              </li>
              {'\n          '}
              <li>
                {'Üst paneldeki '}
                <strong>{'Yazı Boyutu'}</strong>
                {', '}
                <strong>{'Satır Uzunluğu'}</strong>
                {',\n            '}
                <strong>{'Satır Aralığı'}</strong>
                {' ve '}
                <strong>{'Karakter Adı'}</strong>
                {
                  ' alanlarına görünür etiketler eklendi;\n            hangi kutunun neyi temsil ettiği artık bir bakışta anlaşılıyor.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Yazı tipi boyutunda ondalıklı değerler (örn. 12.5) artık satır kırma hesabında doğru işleniyor.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.4.2 — Kontrast Motoru Güncellemesi'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {'Kontrast özelliği, artık sadece aşağıya değil, yazının '}
                <strong>{'her yönüne'}</strong>
                {' eşit dağılan bir gölge\n            (kontur) oluşturacak şekilde güncellendi.'}
              </li>
              {'\n          '}
              <li>
                {'Üç kademe (Düşük / Orta / Yüksek) yeniden ayarlandı. Yeni sistemde '}
                <strong>{'Düşük'}</strong>
                {
                  ' seviye, eski\n            versiyondaki anahatla aynı incelikte, temiz bir kenarlık sağlıyor. '
                }
                <strong>{'Orta'}</strong>
                {' ve\n            '}
                <strong>{'Yüksek'}</strong>
                {'\n            seviyeler ise kademeli olarak güçlenecek şekilde revize edildi.'}
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.4.1 — Hibrit Mimari & Görsel Kalibrasyon'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'İngilizce ve Türkçe log formatları hibrit bir mimariyle tek çatı altında birleştirilerek uyuşturucu, eşya\n            transferi ve hapis gibi bilgi mesajlarının her iki dilde de kusursuz çalışması sağlandı.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Ana menü kalabalığını azaltmak adına sistem bildirimlerini açıp kapatan filtre, ekranın sağ üst köşesine\n            sabitlenmiş modern bir süzülen ikon (Floating Action Button) mimarisine taşındı.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Loglarınızda sıkça karşılaştığınız "isim ve eylemin bitişik yazılması" sorunu (Örn: > John Doegülümser),\n            metin içindeki yanlış kelime bölünmelerini (bugları) önlemek amacıyla '
                }
                <strong>
                  {
                    'sadece sisteme kaydettiğiniz\n              kendi karakter adınızda geçerli olacak şekilde'
                  }
                </strong>
                {' otomatik boşluk bırakılarak çözüldü.'}
              </li>
              {'\n          '}
              <li>
                {
                  'Ş, ç, g gibi alt kuyruklu harflerin ve özel sembollerin arka plan boyama alanının dışına taşması sorunu,\n            detaylı bir padding kalibrasyonu ile tamamen giderildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Çıktı ekranında görsel kirlilik yaratan "CHAT LOG:" ibareleri ve gereksiz sistem mesajları, metnin anlam\n            bütünlüğü bozulmadan otomatik olarak temizlenecek şekilde ayarlandı.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">
              {'v1.4.0 (Altyapı Optimizasyonu & Genişletilmiş Araçlar)'}
            </h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'Sistem tarafından atanan otomatik renk kilitleri devreden çıkarıldı. Yeni "TreeWalker" altyapısı\n            sayesinde, ekrandaki spesifik kelimeler veya satırlar üzerindeki manuel renk atama kısıtlamaları tamamen\n            kaldırılarak serbest seçim mimarisine geçildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Rol akışını ve okunabilirliği bozan gereksiz sistem mesajlarının (kapı kilitleri, eşya/mülk uyarıları,\n            puan bildirimleri vb.) yarattığı kirliliği engellemek amacıyla, tek tıkla kontrol edilebilen "Sistem\n            Bildirimleri" filtresi entegre edildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Hava durumu, [STREET], departman ve interkom loglarını tarayan motor optimize edildi. Sunucu kaynaklı\n            oluşabilecek format, boşluk veya harf farklılıklarına karşı sistemin tolerans eşiği artırılarak\n            biçimlendirme hataları kesin olarak önlendi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Çıktı ekranındaki metin dizilimi standartlara uygun olarak yeniden yapılandırıldı. Satır aralıkları\n            (spacing) normalize edilerek, sıkışık görünüm engellendi ve görsel bütünlük sağlandı.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Karakter mal varlığı ve banka verilerini içeren log satırlarındaki bölme ("/") sembollerinin, sistemin\n            italik metin formatlayıcısı ile çakışması sonucu oluşan hatalı biçimlendirme sorunu kökünden giderildi.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.3.0 (Arayüz & Özellik Güncellemesi)'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'Sohbet çıktılarını indirmeden doğrudan kopyalamak için "Kopyala"\n            düğmesi eklendi.'
                }
              </li>
              {'\n          '}
              <li>
                {'Sohbet içinde *emote* vurgulaması ve /italic/ desteği eklendi.\n          '}
              </li>
              {'\n          '}
              <li>
                {
                  'Ayarlar kısmından italik ayrıştırmayı dilediğiniz gibi kapatıp\n            açabilirsiniz.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.2.2 (Hata Düzeltmesi)'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {'Özellikle '}
                <strong>{"UCP'den alınan chatloglarında"}</strong>
                {' sıkça karşılaşılan ve metnin arasına karışarak\n            metni bozan '}
                <strong>{'~y~'}</strong>
                {
                  ' etiketleri sorunu tamamen çözüldü. Bu ibareler artık sihirbaza\n            girdiği an otomatik olarak temizleniyor.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.2.1 (Editör Güncellemesi)'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                <strong>{'"Parlaklık", "Kontrast", "Doygunluk" ve "Vinyet"'}</strong>
                {
                  ' ayarları eklendi. Artık fotoğrafınızın\n            birçok görüntü ayarını bunları kullanarak gerçekleştirebileceksiniz.'
                }
              </li>
              {'\n          '}
              <li>
                <strong>{'Satır Gizle/Göster aracı'}</strong>
                {
                  ' eklendi. Fazladan eklediğiniz veya istemediğiniz satırları bu\n            araç ile gizleyebilirsiniz.'
                }
              </li>
              {'\n          '}
              <li>
                {'Fotoğraf editörüne '}
                <strong>{'Ctrl+Z / Ctrl+Y'}</strong>
                {' ile çalışan kapsamlı Undo/Redo (Geri/İleri Alma)\n            sistemi eklendi.'}
              </li>
              {'\n          '}
              <li>
                {
                  'Sağ tık bağlam menüsü, kırpma aracı, özel metin ekleme aracı tamamen baştan yazılarak aktif hale\n            getirildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Seçili satırları büyütüp küçültmeyi sağlayan "Seçim/Boyutlandırma Çerçeveleri" (Handles) sisteme entegre\n            edildi.'
                }
              </li>
              {'\n          '}
              <li>
                {
                  'Alt kısımdaki durum çubuğu (Status bar) aktif araç, boyut ve koordinat takiplerini yapacak şekilde\n            canlandırıldı.'
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.2.0'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  "UCP'den alınan chatloglarında gözüken !{#C2A2DA} tarzındaki hex kodları artık algılanıp yazıyı otomatik\n            olarak belirtilen renge boyuyor."
                }
              </li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n\n      '}
          <div className="cl-entry">
            {'\n        '}
            <div className="cl-dot cl-dot-old"></div>
            {'\n        '}
            <h3 className="cl-title-old">{'v1.1.0'}</h3>
            {'\n        '}
            <ul className="cl-list">
              {'\n          '}
              <li>
                {
                  'Sohbet eklendikten sonra karakter adı girildiğinde renklerin eş zamanlı yenilenmesi sağlandı.'
                }
              </li>
              {'\n          '}
              <li>{'İsimleri kapatma butonu düzeltildi, artık direkt standart beyaza dönüyor.'}</li>
              {'\n          '}
              <li>{'Tüm özellik renkleri, butonlar ve yönlendiriciler Türkçeleştirildi.'}</li>
              {'\n          '}
              <li>{'Renk hafızası sıfırdan yazıldı, manuel ayarlanan renkler asla bozulmuyor.'}</li>
              {'\n        '}
            </ul>
            {'\n      '}
          </div>
          {'\n    '}
        </div>
        {'\n  '}
      </div>
      {'\n\n  '}
      <div
        id="feedbackModal"
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedbackTitle"
        style={{
          display: 'none',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          inset: '0',
          zIndex: '10000',
        }}
      >
        {'\n\n    '}
        <div
          id="feedbackBackdrop"
          style={{
            position: 'absolute',
            inset: '0',
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(6px)',
          }}
        ></div>
        {'\n\n    '}
        <div
          className="help-modal-content"
          style={{
            maxWidth: '500px',
            width: '92%',
            background: '#1b1f27',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            position: 'relative',
            zIndex: '10002',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
          }}
        >
          {'\n\n      '}
          {/* Header */}
          {'\n      '}
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            {'\n        '}
            <div>
              {'\n          '}
              <h2
                id="feedbackTitle"
                style={{
                  margin: '0 0 2px',
                  fontSize: '15px',
                  color: '#f1f1f1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {'\n            '}
                <i
                  className="fas fa-comment-dots"
                  style={{ color: '#3498db', fontSize: '14px' }}
                ></i>
                {'\n            İstek & Öneri\n          '}
              </h2>
              {'\n        '}
            </div>
            {'\n        '}
            <button
              id="closeFeedbackModal"
              type="button"
              className="feedback-close"
              aria-label="Kapat"
              style={{
                background: 'none',
                border: 'none',
                color: '#555',
                cursor: 'pointer',
                fontSize: '16px',
                lineHeight: '1',
                padding: '4px',
              }}
            >
              {'\n          '}
              <i className="fas fa-times"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n\n      '}
          {/* Body */}
          {'\n      '}
          <div
            style={{
              padding: '18px 20px',
              maxHeight: '70vh',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            {'\n\n        '}
            <div
              id="feedbackStatus"
              style={{
                display: 'none',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                textAlign: 'center',
              }}
            ></div>
            {'\n\n        '}
            {/* Kategori seçici */}
            {'\n        '}
            <div>
              {'\n          '}
              <label
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {'Konu'}
              </label>
              {'\n          '}
              <div
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}
                id="feedbackCategoryBtns"
              >
                {'\n            '}
                <button
                  type="button"
                  data-cat="suggestion"
                  aria-pressed="true"
                  style={{
                    padding: '8px 6px',
                    background: 'rgba(52,152,219,0.15)',
                    border: '1px solid rgba(52,152,219,0.4)',
                    color: '#3498db',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: '0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  {'\n              '}
                  <i className="fas fa-lightbulb"></i>{' '}
                  <span data-i18n="feedback.catSuggestion">{'İstek'}</span>
                  {'\n            '}
                </button>
                {'\n            '}
                <button
                  type="button"
                  data-cat="bug"
                  aria-pressed="false"
                  style={{
                    padding: '8px 6px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: '0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  {'\n              '}
                  <i className="fas fa-bug"></i> <span data-i18n="feedback.catBug">{'Hata'}</span>
                  {'\n            '}
                </button>
                {'\n            '}
                <button
                  type="button"
                  data-cat="translation"
                  id="feedbackCategoryTranslation"
                  aria-pressed="false"
                  style={{
                    padding: '8px 6px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.5)',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    cursor: 'pointer',
                    transition: '0.15s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '5px',
                  }}
                >
                  {'\n              '}
                  <i className="fas fa-language"></i>{' '}
                  <span data-i18n="feedback.catTranslation">{'Çeviri'}</span>
                  {'\n            '}
                </button>
                {'\n          '}
              </div>
              {'\n          '}
              <input type="hidden" id="feedbackCategory" defaultValue={'suggestion'} />
              {'\n        '}
            </div>
            {'\n\n        '}
            {/* Çeviri hint — sadece translation seçiliyken görünür */}
            {'\n        '}
            <div
              id="translationHint"
              style={{
                display: 'none',
                background: 'rgba(243,156,18,0.07)',
                border: '1px solid rgba(243,156,18,0.18)',
                borderLeft: '3px solid #f39c12',
                borderRadius: '6px',
                padding: '9px 12px',
                fontSize: '12px',
                color: 'rgba(255,255,255,0.55)',
                lineHeight: '1.55',
              }}
            >
              {'\n          '}
              <i
                className="fas fa-info-circle"
                style={{ color: '#f39c12', marginRight: '5px' }}
              ></i>
              {'\n          Açıklama alanına hangi sistem mesajının '}
              <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{'boyanmadığını'}</strong>
              {'\n          ve varsa log örneğini yazarsanız çok yardımcı olursunuz.\n        '}
            </div>
            {'\n\n        '}
            {/* Başlık */}
            {'\n        '}
            <div>
              {'\n          '}
              <label
                htmlFor="feedbackSummary"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {'Başlık\n            *'}
              </label>
              {'\n          '}
              <input
                type="text"
                id="feedbackSummary"
                minLength={4}
                maxLength={120}
                placeholder="En az 4 karakter"
                required
                style={{
                  width: '100%',
                  background: '#11141a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px 12px',
                  color: '#f1f1f1',
                  borderRadius: '7px',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
              />
              {'\n        '}
            </div>
            {'\n\n        '}
            {/* Açıklama */}
            {'\n        '}
            <div>
              {'\n          '}
              <label
                htmlFor="feedbackDescription"
                style={{
                  display: 'block',
                  marginBottom: '6px',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '11px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {'Açıklama\n            *'}
              </label>
              {'\n          '}
              <textarea
                id="feedbackDescription"
                rows={4}
                minLength={10}
                maxLength={2000}
                placeholder="En az 10 karakter..."
                required
                style={{
                  width: '100%',
                  background: '#11141a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '10px 12px',
                  color: '#f1f1f1',
                  borderRadius: '7px',
                  fontSize: '13px',
                  resize: 'vertical',
                  minHeight: '90px',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                  boxSizing: 'border-box',
                }}
              />
              {'\n        '}
            </div>
            {'\n\n        '}
            {/* Alt satır: Öncelik + Discord */}
            {'\n        '}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {'\n          '}
              <div>
                {'\n            '}
                <label
                  htmlFor="feedbackPriority"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {'Öncelik'}
                </label>
                {'\n            '}
                <select
                  defaultValue={'medium'}
                  id="feedbackPriority"
                  style={{
                    width: '100%',
                    background: '#11141a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '10px 12px',
                    color: '#f1f1f1',
                    borderRadius: '7px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {'\n              '}
                  <option value={'low'}>{'Pek önemli değil'}</option>
                  {'\n              '}
                  <option value={'medium'}>{'İyileştirilse iyi olur'}</option>
                  {'\n              '}
                  <option value={'high'}>{'Önemli'}</option>
                  {'\n            '}
                </select>
                {'\n          '}
              </div>
              {'\n          '}
              <div>
                {'\n            '}
                <label
                  htmlFor="feedbackDiscord"
                  style={{
                    display: 'block',
                    marginBottom: '6px',
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '11px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  {'Discord\n              '}
                  <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>
                    {'(isteğe bağlı)'}
                  </span>
                </label>
                {'\n            '}
                <input
                  type="text"
                  id="feedbackDiscord"
                  maxLength={100}
                  style={{
                    width: '100%',
                    background: '#11141a',
                    border: '1px solid rgba(255,255,255,0.08)',
                    padding: '10px 12px',
                    color: '#f1f1f1',
                    borderRadius: '7px',
                    fontSize: '12px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {'\n          '}
              </div>
              {'\n        '}
            </div>
            {'\n        '}
            <label
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                color: 'rgba(255,255,255,0.65)',
                fontSize: '12px',
              }}
            >
              {'\n          '}
              <input type="checkbox" id="feedbackDiagnosticConsent" />
              {
                '\n          Tarayıcı ailesi, platform ailesi, uygulama sürümü ve hata kodlarını ekle. Sohbet veya proje içeriği eklenmez.\n        '
              }
            </label>
            {'\n\n      '}
          </div>
          {'\n\n      '}
          {/* Footer */}
          {'\n      '}
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
            }}
          >
            {'\n        '}
            <button
              id="closeFeedbackBtn"
              type="button"
              className="feedback-cancel"
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                borderRadius: '7px',
                fontSize: '13px',
                transition: '0.15s',
              }}
              data-i18n="ui.cancel"
            >
              {'\n          Vazgeç\n        '}
            </button>
            {'\n        '}
            <button
              id="submitFeedbackBtn"
              type="button"
              className="feedback-submit"
              style={{
                padding: '8px 18px',
                background: '#3498db',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                borderRadius: '7px',
                fontSize: '13px',
                fontWeight: '600',
                transition: 'opacity 0.15s',
              }}
              data-i18n="feedback.send"
            >
              {'\n          Gönder\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n    '}
        </div>
        {'\n  '}
      </div>
      {'\n\n  '}
      <p id="projectStatus" className="local-project-status" role="status" aria-live="polite"></p>
      {'\n\n  '}
      <dialog
        id="recoveryDialog"
        className="local-dialog local-dialog--decision"
        aria-labelledby="recoveryTitle"
      >
        {'\n    '}
        <h2 id="recoveryTitle" data-i18n="projects.recoveryTitle">
          {'Kaydedilmemiş çalışma bulundu'}
        </h2>
        {'\n    '}
        <p>{'Son otomatik kaydı geri yükleyebilir veya temiz bir projeyle başlayabilirsiniz.'}</p>
        {'\n    '}
        <div className="local-dialog__actions">
          {'\n      '}
          <button
            id="recoveryRestore"
            type="button"
            className="local-action local-action--primary"
            data-i18n="projects.restore"
          >
            {'Geri Yükle'}
          </button>
          {'\n      '}
          <button
            id="recoveryFresh"
            type="button"
            className="local-action"
            data-i18n="projects.fresh"
          >
            {'Yeni Başlat'}
          </button>
          {'\n    '}
        </div>
        {'\n  '}
      </dialog>
      {'\n\n  '}
      <dialog
        id="localProjectsDialog"
        className="local-dialog"
        aria-labelledby="localProjectsTitle"
      >
        {'\n    '}
        <header className="local-dialog__header">
          {'\n      '}
          <h2 id="localProjectsTitle" data-i18n="projects.localTitle">
            {'Yerel projeler'}
          </h2>
          {'\n      '}
          <form method="dialog">
            <button
              type="submit"
              className="local-icon-button"
              aria-label="Kapat"
              data-i18n-aria-label="ui.close"
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </form>
          {'\n    '}
        </header>
        {'\n    '}
        <div id="localProjectsList" className="local-dialog__body"></div>
        {'\n    '}
        <div className="local-dialog__actions">
          {'\n      '}
          <button
            id="projectSnapshot"
            type="button"
            className="local-action local-action--primary"
            data-i18n="projects.snapshot"
          >
            {'Anlık kayıt oluştur'}
          </button>
          {'\n      '}
          <button
            id="clearLocalData"
            type="button"
            className="local-action local-action--danger"
            data-i18n="projects.clearData"
          >
            {'Yerel verileri sil'}
          </button>
          {'\n    '}
        </div>
        {'\n  '}
      </dialog>
      {'\n\n  '}
      <dialog id="imageStackDialog" className="local-dialog" aria-labelledby="imageStackTitle">
        {'\n    '}
        <header className="local-dialog__header">
          {'\n      '}
          <h2 id="imageStackTitle" data-i18n="projects.stack">
            {'Görsel yığını'}
          </h2>
          {'\n      '}
          <form method="dialog">
            <button
              type="submit"
              className="local-icon-button"
              aria-label="Kapat"
              data-i18n-aria-label="ui.close"
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </form>
          {'\n    '}
        </header>
        {'\n    '}
        <div id="imageStackList" className="local-dialog__body"></div>
        {'\n    '}
        <div className="local-dialog__actions">
          {'\n      '}
          <button
            id="imageStackSave"
            type="button"
            className="local-action local-action--primary"
            data-i18n="projects.stackSave"
          >
            {"Canvas'ı yığına ekle"}
          </button>
          {'\n      '}
          <button
            id="imageStackDownloadSelected"
            type="button"
            className="local-action"
            data-i18n="projects.stackDownload"
          >
            {'Seçilenleri indir'}
          </button>
          {'\n      '}
          <button
            id="imageStackDeleteSelected"
            type="button"
            className="local-action local-action--danger"
            data-i18n="projects.stackDelete"
          >
            {'Seçilenleri sil'}
          </button>
          {'\n    '}
        </div>
        {'\n  '}
      </dialog>
      {'\n\n  '}
      <dialog id="customFontsDialog" className="local-dialog" aria-labelledby="customFontsTitle">
        {'\n    '}
        <header className="local-dialog__header">
          {'\n      '}
          <h2 id="customFontsTitle" data-i18n="projects.fonts">
            {'Özel fontlar'}
          </h2>
          {'\n      '}
          <form method="dialog">
            <button
              type="submit"
              className="local-icon-button"
              aria-label="Kapat"
              data-i18n-aria-label="ui.close"
            >
              <i className="fas fa-xmark" aria-hidden="true"></i>
            </button>
          </form>
          {'\n    '}
        </header>
        {'\n    '}
        <div id="customFontsList" className="local-dialog__body"></div>
        {'\n    '}
        <div className="local-dialog__actions">
          {'\n      '}
          <button id="customFontAdd" type="button" className="local-action local-action--primary">
            <i className="fas fa-plus" aria-hidden="true"></i>{' '}
            <span data-i18n="projects.fontAdd">{'Font ekle'}</span>
          </button>
          {'\n    '}
        </div>
        {'\n  '}
      </dialog>
      {'\n\n  '}
      <dialog
        id="clearLocalDialog"
        className="local-dialog local-dialog--decision"
        aria-labelledby="clearLocalTitle"
      >
        {'\n    '}
        <h2 id="clearLocalTitle" data-i18n="projects.clearData">
          {'Yerel verileri sil'}
        </h2>
        {'\n    '}
        <p>
          {
            'Tüm yerel projeler, otomatik kayıtlar, görseller ve özel fontlar kalıcı olarak silinir.'
          }
        </p>
        {'\n    '}
        <div className="local-dialog__actions">
          {'\n      '}
          <button
            id="clearLocalConfirm"
            type="button"
            className="local-action local-action--danger"
            data-i18n="ui.delete"
          >
            {'Tümünü sil'}
          </button>
          {'\n      '}
          <form method="dialog">
            <button type="submit" className="local-action" data-i18n="ui.cancel">
              {'Vazgeç'}
            </button>
          </form>
          {'\n    '}
        </div>
        {'\n  '}
      </dialog>
      {'\n\n  '}
      {/* Lisans Uyumluluğu & Durum Bilgilendirme Modalı */}
      {'\n  '}
      <div
        id="noticeModal"
        className="help-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="noticeModalTitle"
        style={{ display: 'none' }}
      >
        {'\n    '}
        <div id="noticeModalBackdrop" className="help-modal-backdrop"></div>
        {'\n    '}
        <div className="help-modal-content" style={{ maxWidth: '720px', width: '95%' }}>
          {'\n      '}
          <div className="help-modal-header">
            {'\n        '}
            <h2 id="noticeModalTitle">
              {'\n          '}
              <i
                className="fas fa-file-contract"
                style={{ color: '#38bdf8' }}
                aria-hidden="true"
              ></i>
              {'\n          '}
              <span data-i18n="noticeModal.title">
                {'Lisans Bildirimi, Geliştirme Süreci ve Şeffaflık Raporu'}
              </span>
              {'\n        '}
            </h2>
            {'\n        '}
            <button
              id="closeNoticeModalBtn"
              type="button"
              className="help-modal-close"
              aria-label="Kapat"
              data-i18n-aria-label="noticeModal.close"
            >
              {'\n          '}
              <i className="fas fa-times" aria-hidden="true"></i>
              {'\n        '}
            </button>
            {'\n      '}
          </div>
          {'\n      '}
          <div className="help-modal-body">
            {'\n        '}
            <div className="notice-modal-section">
              {'\n          '}
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#f8fafc',
                  marginBottom: '6px',
                }}
                data-i18n="noticeModal.greeting"
              >
                {'Selamlar herkese,'}
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.intro">
                {
                  '\n            Kasım-Aralık aylarında kendi SS editlerimi kolaylaştırmak için geliştirmeye başladığım ve Nisan ayında GTA World Türkiye topluluğuna sunduğum Chatlog Magician (TR) projesinde yaşanan teknik lisans sürecini, Blanco ile iletişimimizi ve projenin geldiği noktayı tüm şeffaflığıyla aktarmak istedim.\n          '
                }
              </p>
              {'\n        '}
            </div>
            {'\n\n        '}
            <div className="notice-modal-section">
              {'\n          '}
              <h3 data-i18n="noticeModal.crisisTitle">
                {'Yaşanan Süreç ve Açık Kaynak Projeleri'}
              </h3>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP1">
                {
                  "\n            Orijinal araç, Blanco tarafından MIT lisansıyla açık kaynak olarak paylaşılmıştı. Projeye başladığım ilk günden bu yana forum tanıtımının ilk cümlesinde Blanco'nun orijinal aracına bağlantı verdim ve kaynak kodlarındaki atıfları korudum. Ne orijinal projeyi gizleme ne de başka birinin emeğini sahiplenme gibi bir amacım oldu. Zaten böyle bir niyetim olsaydı tanıtımın ilk satırına orijinal projenin bağlantısını koymaz, sitenin en altına da geliştiricinin adını yazmazdım.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2">
                {
                  "\n            Geçtiğimiz günlerde Vercel üzerinden resmi bir DMCA telif ihlali bildirimiyle karşılaştım. Şikayet metnini incelediğimde, Blanco'nun yalnızca lisans dosyalarının eksikliğinden bahsetmediğini, projenin çeşitli bileşenlerini de doğrudan şikayete konu ettiğini gördüm.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2b">
                {
                  '\n            Bildirimde chatlog-parser.js dosyasının kendisine ait kodun gizlenmiş (obfuscated) hali olduğu, cors-handler.js ve app.css dosyalarında orijinal çalışmasından alınan kodlar bulunduğu ve uygulamamızın kendi arayüzünün Türkçeye çevrilmiş hali olduğu ileri sürülüyordu. Ayrıca canlı sitede telif bildiriminin bulunmadığı ve /LICENSE adresinin 404 hatası verdiği belirtiliyordu.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2c">
                {
                  '\n            Ancak aynı şikayet metninde dikkatimi çeken önemli bir ayrıntı vardı. Blanco, orijinal projenin MIT lisanslı olduğunu ve telif bildirimlerini koruyan çatal (fork) projelerin yasal olduğunu bizzat kabul ediyordu:\n          '
                }
              </p>
              {'\n          '}
              <blockquote
                style={{
                  margin: '8px 0',
                  padding: '8px 12px',
                  background: 'rgba(56, 189, 248, 0.06)',
                  borderLeft: '3px solid #38bdf8',
                  color: '#94a3b8',
                  fontSize: '12.5px',
                  fontStyle: 'italic',
                  borderRadius: '0 4px 4px 0',
                }}
                data-i18n="noticeModal.quote1"
              >
                {
                  '\n            "Those forks are lawful - they kept my copyright notice."\n          '
                }
              </blockquote>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2d">
                {
                  "\n            Kendi orijinal sitesini artık ücretli abonelik sistemiyle (paywall / HTTP 402) sunduğunu da belirten Blanco'nun şikayetindeki temel lisans itirazı, canlı dağıtımımızda gerekli telif ve lisans bildirimlerinin bulunmamasıydı.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2e">
                {
                  "\n            Burada teknik eksikliğin nasıl ortaya çıktığını da açıklamak gerekiyor. Projenin kaynak kod deposunda orijinal lisans ve telif bildirimleri zaten bulunuyordu. Ancak projeyi canlıya alırken kullandığım derleme betiği, yaklaşık 1 KB'lık LICENSE ve NOTICE dosyalarını yayın klasörüne kopyalamıyordu. Dolayısıyla kaynak kodda bulunan bu dosyalara canlı site üzerinden doğrudan erişilmeye çalışıldığında 404 hatası alınıyordu.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2f">
                {
                  '\n            Elbette bu dosyaların dağıtım sırasında da korunmasını sağlamak benim sorumluluğumdu. MIT lisansının tanıdığı kullanım, değiştirme ve yeniden dağıtma hakları, orijinal telif ve izin bildirimlerinin korunması şartını ortadan kaldırmıyor. Ancak kaynak kodda bulunan iki metin dosyasının derleme sırasında yayın klasörüne aktarılmaması ile orijinal projeyi gizlemeye veya başka bir geliştiricinin emeğini sahiplenmeye çalışmak arasında ciddi bir fark olduğunu düşünüyorum.\n          '
                }
              </p>
              {'\n          '}
              <p style={{ fontWeight: '600', color: '#f8fafc' }} data-i18n="noticeModal.crisisP2g">
                {'\n            Asıl eleştirdiğim nokta da burada başlıyor.\n          '}
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2h">
                {
                  "\n            Açık kaynak projelerde böyle bir eksiklikle karşılaşıldığında öncelikle geliştiriciyle iletişime geçmek, bir issue açmak veya mevcut iletişim kanallarından durumu bildirmek bana kalırsa çok daha yapıcı bir yaklaşım. Üstelik benim durumumda orijinal geliştiricinin kimliği gizlenmiş değildi. Forum konusunun ilk cümlesinde orijinal projeye bağlantı veriliyor, uygulamanın alt kısmında Blanco'nun adı bulunuyor ve kaynak kod deposunda lisans bildirimleri korunuyordu.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2i">
                {
                  "\n            Bunların yanında sitede doğrudan bana ulaşılabilecek bir destek ve iletişim bölümü de mevcuttu. Bütün bu imkanlara rağmen Blanco, karşılaştığı eksikliği bana bildirmek yerine doğrudan Vercel'e resmi DMCA şikayetinde bulunmayı tercih etmişti.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2j">
                {'\n            İşin düşündürücü tarafı, '}
                <a
                  href="https://vercel.com/legal/dmca-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  {"Vercel'in kendi DMCA politikasında"}
                </a>
                {
                  " dahi şikayetçinin resmi başvurudan önce site sahibiyle veya yöneticisiyle iletişim kurarak sorunu çözmeyi denemiş olması gerektiğinin açıkça belirtilmesiydi. Dolayısıyla benim eleştirdiğim iletişim eksikliği yalnızca kişisel bir beklentiden veya açık kaynak kültürüne ilişkin görüşümden ibaret değildi. Blanco'nun başvurduğu platform da böyle bir girişimde bulunulmasını öngörüyordu.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2k">
                {
                  '\n            Üstelik söz konusu bildirim, yalnızca bir lisans dosyasının eksik olduğuna ilişkin sıradan bir uyarı değildi. Vercel, iki iş günü içerisinde gerekli işlemleri yapmamam veya kabul edilebilir bir çözüm sunmamam halinde şikayete konu olan içeriğin askıya alınabileceğini bildiriyordu. Şikayetin kapsamına bağlı olarak uygulamanın tamamının erişime kapatılması da ihtimaller arasındaydı.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2l">
                {
                  '\n            Aylarca üzerinde çalıştığınız, kendi ihtiyaçlarınızdan yola çıkarak geliştirdiğiniz ve topluluğa tamamen ücretsiz olarak sunduğunuz bir projenin böyle bir bildirimle karşı karşıya kalması elbette hoş bir deneyim değil. Hele ki eksikliği gidermek için gereken şey, geliştiriciye gönderilecek basit bir mesaj ve birkaç satırlık teknik düzeltmeyken.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP2m">
                {
                  '\n            Bir geliştiricinin kendi eserine ait lisans koşullarının yerine getirilmesini istemesinden daha doğal bir şey yok. Ancak bu hakkın varlığı, sorunun çözümü için tercih edilen yöntemin eleştirilemeyeceği anlamına da gelmiyor. Doğrudan iletişim kurulabilecek bütün kanallar açıkken, ilk temasın barındırma sağlayıcısından gelen bir telif bildirimi üzerinden gerçekleşmesini açık kaynak kültürüne pek yakıştıramadım.\n          '
                }
              </p>
              {'\n\n          '}
              <figure className="notice-modal-figure">
                {'\n            '}
                <a
                  href="assets/images/notice/vercel-complaint.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Büyütmek için tıklayın"
                >
                  {'\n              '}
                  <img
                    src="assets/images/notice/vercel-complaint.png"
                    alt="Vercel Copyright Notice"
                    className="notice-modal-img"
                    loading="lazy"
                  />
                  {'\n            '}
                </a>
                {'\n            '}
                <figcaption>
                  <i
                    className="fas fa-envelope-open-text"
                    aria-hidden="true"
                    style={{ color: '#38bdf8' }}
                  ></i>{' '}
                  <span data-i18n="noticeModal.imgVercelCaption">
                    {'Vercel telif ihlali bildirimi'}
                  </span>
                </figcaption>
                {'\n          '}
              </figure>
              {'\n\n          '}
              <p data-i18n="noticeModal.crisisP3">
                {
                  "\n            Konuyu uzaktan tartışmak veya karşılıklı açıklamalarla büyütmek yerine doğrudan Discord üzerinden Blanco'ya ulaştım. Kendisiyle yaptığımız görüşmede, resmi şikayette yer alan geniş kapsamlı iddialara rağmen meselenin projenin kendisiyle, elde ettiği trafikle veya sitemizin altındaki teşekkür atfıyla ilgili olmadığını ifade etti. Kodlarını çaldığımı düşünmediğini, canlı sitedeki lisans dosyalarına doğrudan erişilememesinin giderilmesini istediğini ve dosyalar erişilebilir hale getirildiğinde Vercel'e gerekli bilgilendirmeyi yapacağını belirtti.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP3b">
                {
                  "\n            Ben de kendisine, doğrudan Vercel'e başvurmak yerine öncelikle benimle iletişime geçmesinin çok daha yapıcı olacağını söyledim. Sitedeki destek kutusundan veya Discord üzerinden gönderilecek basit bir mesajla aynı eksikliği herhangi bir resmi şikayet sürecine gerek kalmadan giderebilirdim. Nitekim Blanco da bu konuda haklı olduğumu kabul ederek şikayette bulunmadan önce benimle iletişime geçmesi gerektiğini açıkça dile getirdi.\n          "
                }
              </p>
              {'\n\n          '}
              <figure className="notice-modal-figure">
                {'\n            '}
                <a
                  href="assets/images/notice/discord-chat-1.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Büyütmek için tıklayın"
                >
                  {'\n              '}
                  <img
                    src="assets/images/notice/discord-chat-1.png"
                    alt="Discord Conversation Part 1"
                    className="notice-modal-img"
                    loading="lazy"
                  />
                  {'\n            '}
                </a>
                {'\n            '}
                <figcaption>
                  <i className="fab fa-discord" aria-hidden="true" style={{ color: '#5865F2' }}></i>{' '}
                  <span data-i18n="noticeModal.imgDiscord1Caption">
                    {'Blanco ile Discord görüşmesi — 1. Bölüm'}
                  </span>
                </figcaption>
                {'\n          '}
              </figure>
              {'\n\n          '}
              <blockquote
                style={{
                  margin: '8px 0',
                  padding: '8px 12px',
                  background: 'rgba(56, 189, 248, 0.06)',
                  borderLeft: '3px solid #38bdf8',
                  color: '#94a3b8',
                  fontSize: '12.5px',
                  fontStyle: 'italic',
                  borderRadius: '0 4px 4px 0',
                }}
                data-i18n="noticeModal.quote2"
              >
                {
                  '\n            "fair enough on the first part. i could have messaged you before filing and i should have. that one\'s on me." (İlk konuda haklısın. Şikayette bulunmadan önce sana mesaj atabilirdim ve atmalıydım. Bu benim hatamdı.)\n          '
                }
              </blockquote>
              {'\n\n          '}
              <figure className="notice-modal-figure">
                {'\n            '}
                <a
                  href="assets/images/notice/discord-chat-2.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Büyütmek için tıklayın"
                >
                  {'\n              '}
                  <img
                    src="assets/images/notice/discord-chat-2.png"
                    alt="Discord Conversation Part 2"
                    className="notice-modal-img"
                    loading="lazy"
                  />
                  {'\n            '}
                </a>
                {'\n            '}
                <figcaption>
                  <i className="fab fa-discord" aria-hidden="true" style={{ color: '#5865F2' }}></i>{' '}
                  <span data-i18n="noticeModal.imgDiscord2Caption">
                    {'Blanco ile Discord görüşmesi — 2. Bölüm ("that one\'s on me")'}
                  </span>
                </figcaption>
                {'\n          '}
              </figure>
              {'\n\n          '}
              <p data-i18n="noticeModal.crisisP3c">
                {
                  "\n            Başından beri beklediğim yaklaşım da tam olarak buydu. Ortada çözülemeyecek bir anlaşmazlık veya uzun sürecek bir teknik problem bulunmuyordu. Nitekim doğrudan iletişim kurduğumuzda, resmi şikayette yer alan iddialardan bağımsız olarak, Blanco'nun talep ettiği düzeltmeler üzerinde kısa sürede anlaşabildik.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.crisisP3d">
                {
                  "\n            Sonuç olarak birkaç mesaj içerisinde çözülebilecek bir mesele, önce barındırma sağlayıcısına yapılan kapsamlı bir DMCA şikayetiyle gündemimize gelmiş oldu. Blanco'nun görüşmemiz sırasında iletişim konusunda yaptığı hatayı kabul etmesini olumlu karşılıyorum. Ancak en başından aynı iletişim kurulmuş olsaydı, muhtemelen bütün bu sürece gerek kalmayacaktı.\n          "
                }
              </p>
              {'\n        '}
            </div>
            {'\n\n        '}
            <div className="notice-modal-section">
              {'\n          '}
              <h3 data-i18n="noticeModal.solutionTitle">{'Çözüm ve Lisans Uyumluluğu'}</h3>
              {'\n          '}
              <p data-i18n="noticeModal.solutionP1">
                {
                  '\n            Bildirimin ardından gerekli teknik düzeltmeleri gerçekleştirdim. Öncelikle derleme betiğini güncelleyerek LICENSE ve NOTICE dosyalarının canlı sitenin kök dizinine aktarılmasını sağladım. Böylece her iki dosya da doğrudan erişilebilir hale getirildi.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.solutionP2">
                {
                  "\n            Bununla da yetinmedim. Şikayette özellikle adı geçen chatlog-parser.js, cors-handler.js ve app.css dosyalarının başına Blanco'nun orijinal MIT telif bildirimlerini ekledim. Bu sayede kaynak kod deposunda zaten bulunan atıfların, ilgili dağıtım dosyalarında da açıkça yer almasını sağladım.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.solutionP3">
                {
                  '\n            Yapılan düzenlemelerle birlikte şikayete konu olan lisans ve telif bildirimi eksiklikleri giderildi. Vercel tarafından tanınan iki iş günlük süre içerisinde gerçekleştirdiğim düzeltmeleri ve bunlara ilişkin kanıtları DMCA ekibine resmi olarak ilettim.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.solutionP4">
                {
                  "\n            Blanco'ya da dosyaların erişilebilir hale getirildiğini bildirdim. Kendisi, görüşmemizde gerekli düzeltmelerin ardından Vercel'e başvurarak şikayetini geri çekeceğini ifade etmişti. Teknik düzeltmeleri ve gerekli bilgilendirmeleri tamamlamış durumdayım; bundan sonraki aşamada sürecin Vercel tarafından resmi olarak sonuçlandırılmasını bekliyorum.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.solutionP5">
                {
                  '\n            Burada özellikle belirtmek istediğim bir diğer nokta da gerçekleştirilen düzeltmelerin yalnızca bildirimin sonuçlandırılması amacıyla yapılmadığı. Orijinal çalışmaya ait telif ve lisans bildirimlerinin korunması, projenin bundan sonraki dağıtımlarında da gözetilecek.\n          '
                }
              </p>
              {'\n          '}
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                {'\n            '}
                <a
                  href="https://chatlog-magician-tr.vercel.app/LICENSE"
                  target="_blank"
                  className="site-notice-link"
                >
                  <i
                    className="fas fa-file-alt"
                    aria-hidden="true"
                    style={{ marginRight: '6px' }}
                  ></i>
                  {'https://chatlog-magician-tr.vercel.app/LICENSE'}
                </a>
                {'\n            '}
                <a
                  href="https://chatlog-magician-tr.vercel.app/NOTICE"
                  target="_blank"
                  className="site-notice-link"
                >
                  <i
                    className="fas fa-copyright"
                    aria-hidden="true"
                    style={{ marginRight: '6px' }}
                  ></i>
                  {'https://chatlog-magician-tr.vercel.app/NOTICE'}
                </a>
                {'\n          '}
              </div>
              {'\n        '}
            </div>
            {'\n\n        '}
            <div className="notice-modal-section">
              {'\n          '}
              <h3 data-i18n="noticeModal.statsTitle">
                {'Geliştirme Süreci ve Güncel İstatistikler'}
              </h3>
              {'\n          '}
              <p data-i18n="noticeModal.statsP1">
                {
                  '\n            Başlangıçta yalnızca kendi ekran görüntülerimi düzenlerken karşılaştığım sorunları gidermek amacıyla kurcaladığım araç, zaman içerisinde hem kendi ihtiyaçlarım hem de topluluktan gelen geri bildirimler doğrultusunda oldukça kapsamlı bir projeye dönüştü.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.statsP1b">
                {
                  '\n            İlk etapta Türkçe karakter desteği ve birkaç kullanım kolaylığı eklemeyi planlıyordum. Ancak süreç içerisinde mevcut yapının ihtiyaç duyduğum özellikleri karşılamadığını gördükçe yalnızca arayüzü geliştirmek yerine uygulamanın önemli bölümlerini yeniden tasarlamaya başladım. Bugün geldiğimiz noktada Chatlog Magician (TR), basit bir sohbet kaydı düzenleyicisinden çok katmanlı bir görsel düzenleme stüdyosuna dönüşmüş durumda.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.statsP1c">
                {
                  '\n            Git geçmişi ve mevcut kod tabanı üzerinde yaptığım analize göre projenin güncel geliştirme rakamları şu şekilde:\n          '
                }
              </p>
              {'\n          '}
              <div className="notice-modal-stat-grid">
                {'\n            '}
                <div className="notice-modal-stat-card">
                  {'\n              '}
                  <span className="notice-modal-stat-val">{'%86,7'}</span>
                  {'\n              '}
                  <span className="notice-modal-stat-desc" data-i18n="noticeModal.stat1Desc">
                    {'Bana Ait Kod Oranı'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="notice-modal-stat-card">
                  {'\n              '}
                  <span className="notice-modal-stat-val">{'+51.700'}</span>
                  {'\n              '}
                  <span className="notice-modal-stat-desc" data-i18n="noticeModal.stat2Desc">
                    {'Yazdığım Kod Satırı'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="notice-modal-stat-card">
                  {'\n              '}
                  <span className="notice-modal-stat-val" data-i18n="noticeModal.stat3Val">
                    {'201 Dosya'}
                  </span>
                  {'\n              '}
                  <span className="notice-modal-stat-desc" data-i18n="noticeModal.stat3Desc">
                    {'Aktif Mimari'}
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <div className="notice-modal-stat-card">
                  {'\n              '}
                  <span className="notice-modal-stat-val" data-i18n="noticeModal.stat4Val">
                    {'227 Commit'}
                  </span>
                  {'\n              '}
                  <span className="notice-modal-stat-desc" data-i18n="noticeModal.stat4Desc">
                    {'Bireysel Geliştirme'}
                  </span>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n          '}
              <p data-i18n="noticeModal.statsP1d">
                {
                  "\n            Git geçmişine dayalı kendi kod analizime göre, orijinal açık kaynak tabanından gelen kısım mevcut kodun yaklaşık %13,3'ünü oluştururken sonradan geliştirdiğim bölümlerin oranı yaklaşık %86,7 seviyesinde. Bu rakamlar, kod tabanındaki değişimin boyutunu göstermek amacıyla paylaştığım satır ve dosya temelli verilerdir.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.statsP1e">
                {
                  '\n            Elbette yazılan satır sayısı tek başına bir projenin niteliğini veya geliştiricinin emeğini ölçmek için yeterli değil. Bu nedenle rakamların arkasında hangi özelliklerin bulunduğundan da bahsetmek istiyorum:\n          '
                }
              </p>
              {'\n\n          '}
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  margin: '10px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  fontSize: '13px',
                }}
              >
                {'\n            '}
                <div>
                  {'\n              '}
                  <strong style={{ color: '#38bdf8' }} data-i18n="noticeModal.featCanvasTitle">
                    {'Canvas ve Katman Yönetimi:'}
                  </strong>
                  {'\n              '}
                  <span style={{ color: '#cbd5e1' }} data-i18n="noticeModal.featCanvasDesc">
                    {
                      ' Orijinal araçtaki sınırlı görsel düzenleme yapısını genişleterek birden fazla görselin ve sohbet bloğunun aynı çalışma alanında kullanılabildiği bir Canvas motoru geliştirdim. Görsellerin katman sıralaması, konumlandırılması, yeniden boyutlandırılması ve kırpılması gibi işlemler artık doğrudan uygulama içerisinden gerçekleştirilebiliyor.'
                    }
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <div>
                  {'\n              '}
                  <strong style={{ color: '#38bdf8' }} data-i18n="noticeModal.featBlocksTitle">
                    {'Bağımsız Sohbet Blokları:'}
                  </strong>
                  {'\n              '}
                  <span style={{ color: '#cbd5e1' }} data-i18n="noticeModal.featBlocksDesc">
                    {
                      ' Kullanıcılar, aynı görsel üzerinde birbirinden bağımsız birden fazla sohbet bloğu oluşturabiliyor. Her bloğun yazı tipi, rengi, boyutu, hizalaması ve konumu ayrı ayrı düzenlenebiliyor. Böylece özellikle birden fazla karakterin veya farklı zamanlarda gerçekleşen konuşmaların bulunduğu ekran görüntülerinde çok daha esnek bir düzenleme imkanı sunuluyor.'
                    }
                  </span>
                  {'\n            '}
                </div>
                {'\n            '}
                <div>
                  {'\n              '}
                  <strong style={{ color: '#38bdf8' }} data-i18n="noticeModal.featCommunityTitle">
                    {'Topluluk Şablonları ve Çoklu Dil Desteği:'}
                  </strong>
                  {'\n              '}
                  <span style={{ color: '#cbd5e1' }} data-i18n="noticeModal.featCommunityDesc">
                    {
                      ' Kullanıcıların hazırladıkları yazı tipi, renk ve gölge kombinasyonlarını kaydedip toplulukla paylaşabilmeleri için bir şablon sistemi oluşturuldu. Ayrıca uygulamanın yalnızca GTA World Türkiye ile sınırlı kalmaması amacıyla kapsamlı bir yerelleştirme altyapısı geliştirildi. Chatlog Magician şu anda Türkçe, İngilizce, İspanyolca ve Rusça olmak üzere dört dili destekliyor.'
                    }
                  </span>
                  {'\n            '}
                </div>
                {'\n          '}
              </div>
              {'\n\n          '}
              <p data-i18n="noticeModal.statsP1f">
                {
                  '\n            Bütün bu geliştirmeler, başlangıçta yalnızca kişisel kullanım için hazırladığım aracın bugün geldiği noktayı gösteriyor. Orijinal projenin sunduğu temel fikre duyduğum saygı devam etmekle birlikte, aradan geçen sürede ortaya koyduğum bağımsız geliştirme emeğinin de göz ardı edilmemesi gerektiğini düşünüyorum.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.statsP2">
                {
                  '\n            6–22 Eylül tarihleri arasındaki Vercel Analytics verilerine göre uygulama 587 tekil ziyaretçiye ve toplam 917 sayfa görüntülenmesine ulaştı.\n          '
                }
              </p>
              {'\n\n          '}
              <figure className="notice-modal-figure" style={{ marginTop: '10px' }}>
                {'\n            '}
                <a
                  href="assets/images/notice/vercel-analytics.png"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Büyütmek için tıklayın"
                >
                  {'\n              '}
                  <img
                    src="assets/images/notice/vercel-analytics.png"
                    alt="Vercel Analytics (6-22 Sep)"
                    className="notice-modal-img"
                    loading="lazy"
                  />
                  {'\n            '}
                </a>
                {'\n            '}
                <figcaption>
                  <i
                    className="fas fa-chart-line"
                    aria-hidden="true"
                    style={{ color: '#38bdf8' }}
                  ></i>{' '}
                  <span data-i18n="noticeModal.imgAnalyticsCaption">
                    {'Vercel Analytics verileri (6–22 Eylül)'}
                  </span>
                </figcaption>
                {'\n          '}
              </figure>
              {'\n\n          '}
              <p data-i18n="noticeModal.statsP3">
                {
                  '\n            Başlangıçta yalnızca kendi SS editlerimi kolaylaştırmak amacıyla geliştirmeye başladığım bir aracın bugün yüzlerce farklı ziyaretçiye ulaşması benim için oldukça sevindirici. Özellikle topluluktan gelen geri bildirimlerin doğrudan geliştirme sürecine katkıda bulunduğunu görmek, projeye ayırdığım zamanın karşılığını aldığımı hissettiriyor.\n          '
                }
              </p>
              {'\n        '}
            </div>
            {'\n\n        '}
            <div className="notice-modal-section">
              {'\n          '}
              <h3 data-i18n="noticeModal.openSourceTitle">
                {'Açık Kaynak Ruhu ve Topluluk Emeği'}
              </h3>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP1">
                {
                  '\n            Açık kaynak dünyasının en önemli özelliklerinden biri, geliştiricilerin mevcut çalışmaların üzerine yeni özellikler ekleyebilmesi ve bu çalışmaları farklı toplulukların ihtiyaçlarına uyarlayabilmesidir. MIT lisansı da orijinal telif ve izin bildirimlerinin korunması şartıyla yazılımın kullanılmasına, değiştirilmesine ve yeniden dağıtılmasına açıkça izin veriyor.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP2">
                {
                  '\n            Bir projeyi temel alıp geliştirmek, yeni özellikler eklemek, farklı dillere uyarlamak ve topluluğun kullanımına sunmak, ilgili lisansın koşullarına uyulduğu sürece açık kaynak geliştirme modelinin sağladığı imkanlardan biri. Burada önemli olan, orijinal geliştiricinin emeğini yok saymadan yeni katkılar ortaya koyabilmek. Ben de Chatlog Magician (TR) projesinde ilk günden itibaren bunu yapmaya çalıştım.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP3">
                {
                  '\n            Ancak açık kaynak kültürünün yalnızca lisans koşullarından ibaret olmadığını da düşünüyorum. Geliştiriciler arasında kurulan iletişim, karşılaşılan sorunların yapıcı şekilde bildirilmesi ve mümkün olduğunda birlikte çözülmesi de bu kültürün önemli bir parçası.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP4">
                {
                  '\n            Bu nedenle yaşadığımız süreçte beni asıl rahatsız eden, lisans dosyalarındaki teknik eksikliğin gündeme getirilmesi değil, herhangi bir ön iletişim kurulmadan doğrudan resmi telif şikayeti yoluna başvurulmasıydı.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP5">
                {
                  '\n            Üstelik söz konusu şikayetin, projenin çeşitli bileşenlerini de kapsayacak şekilde hazırlanmış olması ve uygulamanın yayından kaldırılmasına kadar uzanabilecek bir süreci başlatması, basit bir iletişimle çözülebilecek bu meseleyi gereğinden fazla büyüttü.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP6">
                {
                  '\n            Nitekim Blanco ile doğrudan iletişim kurduğumuzda, gerekli düzeltmeleri belirleyebildik ve kendisi de şikayetten önce bana mesaj atması gerektiğini kabul etti.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP7">
                {
                  '\n            Dolayısıyla mesele hiçbir zaman bir geliştiricinin kendi eserine ait hakları korumaya çalışmasına karşı çıkmak değildi. Benim eleştirim, bu hakların korunması için başvurulan yöntemin, sorunun boyutuyla ve açık kaynak projelerde beklediğim iletişim anlayışıyla ne kadar örtüştüğüne yönelikti.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP8">
                {
                  '\n            Toplulukta ihtiyacımız olan şey, mevcut çalışmaların üzerine yeni katkılar koyan geliştiricilerin birbirleriyle iletişim kurabilmesi ve ortaya çıkan sorunların mümkün olduğunca yapıcı biçimde çözülebilmesi. Orijinal eser sahibinin emeğinin korunması kadar, bu eserden yola çıkarak aylarını yeni özellikler geliştirmeye ayıran kişilerin emeğinin de görülmesi gerektiğine inanıyorum.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.openSourceP9">
                {
                  '\n            Sonuçta aynı ekosistemin içerisinde üretim yapıyoruz. Birbirimizin çalışmalarından yararlanabilmek, hataları bildirebilmek ve gerektiğinde karşılıklı olarak çözüm üretebilmek, açık kaynak kültürünü benim için değerli kılan şeylerin başında geliyor.\n          '
                }
              </p>
              {'\n        '}
            </div>
            {'\n\n        '}
            <div className="notice-modal-section" style={{ marginBottom: '0' }}>
              {'\n          '}
              <h3 data-i18n="noticeModal.conclusionTitle">{'Son Söz ve Teşekkür'}</h3>
              {'\n          '}
              <p data-i18n="noticeModal.conclusionP1">
                {
                  '\n            Özetle, orijinal projenin kimliğini gizleme veya başka bir geliştiricinin emeğini sahiplenme gibi bir durum söz konusu değildi. Yaşanan süreçte kaynak kod deposunda bulunan lisans dosyalarının canlı dağıtıma aktarılmadığı ortaya çıktı. Bunun yanında şikayete konu edilen JavaScript ve CSS dosyalarındaki telif bildirimlerini de gözden geçirerek gerekli düzenlemeleri yaptım.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.conclusionP2">
                {
                  '\n            Blanco ile doğrudan iletişime geçerek meseleyi görüştük, karşılıklı olarak beklentilerimizi ifade ettik ve talep edilen teknik düzeltmeleri gerçekleştirdim. Şimdi sürecin Vercel tarafında da resmi olarak sonuçlandırılmasını bekliyorum.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.conclusionP3">
                {
                  '\n            Keşke bütün bunların başlangıcı bir DMCA bildirimi yerine basit bir mesaj olsaydı. Ancak yaşananları geride bırakıp projeyi geliştirmeye devam etmek istiyorum.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.conclusionP4">
                {
                  '\n            Sitemizin alt kısmında cred: Blanco ibaresiyle orijinal çalışmaya yönelik atfı korurken, kendi geliştirdiğim özellikleri iyileştirmeye ve yeni özellikler eklemeye devam edeceğim. Chatlog Magician (TR), bugüne kadar olduğu gibi bundan sonra da topluluğun kullanımına tamamen ücretsiz ve reklamsız olarak sunulmaya devam edecek.\n          '
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.conclusionP5">
                {
                  "\n            Aracı kullanan, hata bildiren, önerileriyle geliştirme sürecine katkıda bulunan ve hazırladıkları SS'lerle projeyi kullanan tüm oyunculara teşekkür ederim.\n          "
                }
              </p>
              {'\n          '}
              <p data-i18n="noticeModal.conclusionP6">
                {'\n            İyi oyunlar ve keyifli roller dilerim.\n          '}
              </p>
              {'\n        '}
            </div>
            {'\n      '}
          </div>
          {'\n      '}
          <div
            className="help-modal-footer"
            style={{ padding: '12px 20px', display: 'flex', justifyContent: 'flex-end' }}
          >
            {'\n        '}
            <button
              id="okNoticeModalBtn"
              type="button"
              className="button small primary"
              style={{ margin: '0', borderRadius: '6px' }}
              data-i18n="noticeModal.ok"
            >
              {'Anladım'}
            </button>
            {'\n      '}
          </div>
          {'\n    '}
        </div>
        {'\n  '}
      </div>
      {'\n\n  '}
      <footer className="site-signature">
        {'\n    '}
        <p style={{ margin: '0', letterSpacing: '0.5px' }}>
          {'\n      '}
          <i className="fas fa-code" style={{ marginRight: '5px' }}></i>
          {' GTA World Türkiye için '}
          <strong>
            <a
              className="legacy-hover-link"
              href="https://forum-tr.gta.world/index.php?/profile/8001-murcielago/"
              target="_blank"
              style={{
                color: 'inherit',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(255,255,255,0.3)',
                transition: 'color 0.2s, text-decoration-color 0.2s',
              }}
            >
              {'murcielago'}
            </a>
          </strong>
          {'\n      tarafından geliştirilmektedir.\n      '}
          <span style={{ margin: '0 10px', opacity: '0.5' }}>{'|'}</span>
          {'\n      '}
          <strong>
            <a
              className="legacy-hover-link"
              href="https://forum-tr.gta.world/index.php?/topic/27368-chatlog-magician/"
              target="_blank"
              style={{
                color: 'inherit',
                textDecoration: 'underline',
                textDecorationColor: 'rgba(255,255,255,0.3)',
                transition: 'color 0.2s, text-decoration-color 0.2s',
              }}
            >
              {'\n          Tanıtımı İncele'}
            </a>
          </strong>
          {'\n    '}
        </p>
        {'\n    '}
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            // a11y: no dimming — 0.5 opacity put the legal text at 2.03:1 contrast
            opacity: '1',
            display: 'flex',
            flexDirection: 'column',
            gap: '3px',
          }}
        >
          {'\n      '}
          <p style={{ margin: '0' }}>
            {
              'Resmi olmayan, hayran yapımı bir araçtır (Unofficial fan-made tool). GTA World veya GTA World Türkiye ile bağlantısı yoktur.'
            }
          </p>
          {'\n    '}
        </div>
        {'\n  '}
      </footer>
      {'\n'}
    </>
  );
}
