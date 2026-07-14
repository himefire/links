// =========================================================================
// LP 計測（GA4 + アフィリエイトクリック計測）
//
// 目的: 「どの商品のどのボタン（Amazon/楽天）が何回押されたか」を計測し、
//       感覚ではなく数字でLPを改善できるようにする。
//
// 使い方（ユーザーが1回だけ設定）:
//   1. https://analytics.google.com/ で GA4 プロパティを作成
//   2. 「データストリーム」→ ウェブ → 測定ID（G-XXXXXXXXXX）をコピー
//   3. 下の GA4_MEASUREMENT_ID に貼り付けて公開するだけ
//   ※ IDが未設定（空）の間は、GA4は読み込まれず、クリックは
//      ブラウザのコンソールにだけ出る（動作確認用）。サイトは壊れない。
// =========================================================================

// ▼▼▼ ここに GA4 測定ID を貼る（例: 'G-ABCD1234XY'）。空のままでも動作する ▼▼▼
const GA4_MEASUREMENT_ID = 'G-QNNKK8QJTH'; // GA4プロパティ「アフィリLP」
// ▲▲▲

(function () {
    const hasGA4 = /^G-[A-Z0-9]+$/i.test(GA4_MEASUREMENT_ID);

    // --- GA4 読み込み（IDが設定されている場合のみ） ---
    if (hasGA4) {
        const s = document.createElement('script');
        s.async = true;
        s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA4_MEASUREMENT_ID;
        document.head.appendChild(s);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        window.gtag('js', new Date());
        // アウトバウンド遷移で計測が飛ぶ前にビーコンを確実に送る
        window.gtag('config', GA4_MEASUREMENT_ID, { transport_type: 'beacon' });
    }

    // --- イベント送信の共通関数（GA4があれば送信、無ければconsole） ---
    function sendEvent(name, params) {
        if (hasGA4 && window.gtag) {
            window.gtag('event', name, params);
        } else {
            // 動作確認用: IDが未設定でもクリックが取れているか目視できる
            console.log('[analytics]', name, params);
        }
    }
    // 他スクリプト（app.js等）からも呼べるように公開
    window.lpTrack = sendEvent;

    // --- アフィリエイトCTAクリックの計測（イベント委譲: 全ページ共通で動く） ---
    // カード側は data-product / data-category / data-asp を持たせておく（app.js側で付与）
    document.addEventListener('click', function (e) {
        const cta = e.target.closest('a.card-cta');
        if (cta) {
            sendEvent('affiliate_click', {
                product_name: cta.getAttribute('data-product') || '(unknown)',
                item_category: cta.getAttribute('data-category') || '(unknown)',
                asp: cta.getAttribute('data-asp') || '(unknown)',
                link_url: cta.href,
                // GA4推奨: 外部リンク遷移
                outbound: true
            });
            return;
        }
        // ハブページのカテゴリ選択も計測（回遊分析用）
        const hub = e.target.closest('a.hub-card');
        if (hub) {
            sendEvent('select_category', {
                category: (hub.getAttribute('href') || '').replace(/[.\/]/g, '') || '(unknown)'
            });
            return;
        }
        // メルマガ登録リンクの計測
        const optin = e.target.closest('a.optin-cta');
        if (optin) {
            sendEvent('newsletter_click', { link_url: optin.href });
        }
    }, true);
})();
