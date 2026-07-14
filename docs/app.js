// =========================================================================
// LP アプリケーション
// product_library.json を読み込み、検索・フィルタリング付きで商品を表示
//
// カテゴリ別ページ対応:
//   各カテゴリページの index.html で window.HARM_CATEGORY を設定すると、
//   そのカテゴリの商品のみ表示し、フィルタータブを非表示にする。
// =========================================================================

let products = [];       // 全商品データ
let currentFilter = 'all'; // 現在のフィルター
let searchQuery = '';      // 現在の検索クエリ

// --- window.HARM_CATEGORY が設定されていればカテゴリ固定モード ---
const FIXED_CATEGORY = window.HARM_CATEGORY || null;

// --- カテゴリの表示名マッピング ---
const CATEGORY_LABELS = {
    health: '健康・美容',
    ambition: '仕事・スキル',
    relation: '恋愛・人間関係',
    money: 'お金・節約',
};

// --- カテゴリごとの色 ---
const CATEGORY_COLORS = {
    health: '#10b981',
    ambition: '#f59e0b',
    relation: '#ec4899',
    money: '#3b82f6',
};

// --- 初期化 ---
document.addEventListener('DOMContentLoaded', async () => {
    await loadProducts();
    setupSearch();
});

// --- 商品データを読み込む ---
// サブディレクトリ（/health/ 等）からも正しくデータを取得するため、
// 親ディレクトリの data/products.json を参照する
async function loadProducts() {
    try {
        // カテゴリ固定モードならサブディレクトリにいるので ../data/ を参照
        const dataPath = FIXED_CATEGORY ? '../data/products.json' : './data/products.json';
        const res = await fetch(dataPath);
        let allProducts = await res.json();

        // カテゴリ固定モード: 該当カテゴリの商品のみ残す
        if (FIXED_CATEGORY) {
            allProducts = allProducts.filter(p => p.harm_category === FIXED_CATEGORY);
        }

        products = allProducts;
        // 作成日の降順でソート（最新が先）
        products.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // カテゴリ固定モードではフィルタータブを非表示にする
        if (!FIXED_CATEGORY) {
            buildFilterTabs();
        } else {
            // フィルターセクションが存在すれば非表示に
            const filterSection = document.querySelector('.filter-section');
            if (filterSection) filterSection.style.display = 'none';
        }

        render();
    } catch (e) {
        console.error('商品データの読み込みに失敗:', e);
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'block';
            emptyState.querySelector('p').textContent = 'データの読み込みに失敗しました';
        }
    }
}

// --- フィルタータブを動的生成（トップページ用、カテゴリ固定モードでは呼ばれない） ---
function buildFilterTabs() {
    const tabs = document.getElementById('filterTabs');
    if (!tabs) return;

    // 「すべて」は既にHTMLにある
    // 実際に存在するカテゴリだけタブを作る
    const categories = [...new Set(products.map(p => p.harm_category))];
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-tab';
        btn.dataset.filter = cat;
        btn.textContent = CATEGORY_LABELS[cat] || cat;
        btn.addEventListener('click', () => {
            setFilter(cat);
        });
        tabs.appendChild(btn);
    });

    // 「すべて」ボタンのイベント
    const allBtn = tabs.querySelector('[data-filter="all"]');
    if (allBtn) {
        allBtn.addEventListener('click', () => {
            setFilter('all');
        });
    }
}

// --- フィルター切り替え ---
function setFilter(filter) {
    currentFilter = filter;
    // タブのアクティブ状態を更新
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.filter === filter);
    });
    // セクションタイトルを更新
    const title = document.getElementById('productsTitle');
    if (title) {
        if (filter === 'all') {
            title.textContent = 'すべてのアイテム';
        } else {
            title.textContent = CATEGORY_LABELS[filter] || filter;
        }
    }
    render();
}

// --- 検索の設定 ---
function setupSearch() {
    const input = document.getElementById('searchInput');
    if (!input) return;
    let debounceTimer;
    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            searchQuery = input.value.trim().toLowerCase();
            render();
        }, 200);
    });
}

// --- 商品をフィルタリング ---
function getFilteredProducts() {
    return products.filter(p => {
        // カテゴリフィルター（カテゴリ固定モードでは既にフィルタ済みなのでスキップ）
        if (!FIXED_CATEGORY && currentFilter !== 'all' && p.harm_category !== currentFilter) return false;
        // 検索
        if (searchQuery) {
            const haystack = (p.name + ' ' + p.short_name + ' ' + (p.pain_points || []).join(' ') + ' ' + (p.benefits || []).join(' ')).toLowerCase();
            return haystack.includes(searchQuery);
        }
        return true;
    });
}

// --- 7日以内かどうかを判定 ---
function isWithin7Days(dateStr) {
    if (!dateStr) return false;
    const created = new Date(dateStr);
    const now = new Date();
    const diffMs = now - created;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
}

// --- LP表示対象の商品を取得（ピン留め or 7日以内） ---
function getVisibleProducts() {
    return products.filter(p => p.pinned || isWithin7Days(p.created_at));
}

// --- 描画 ---
function render() {
    const isSearching = searchQuery || (!FIXED_CATEGORY && currentFilter !== 'all');

    if (isSearching) {
        // 検索/フィルタ時: TOP3・一覧セクションを非表示、全件表示に切り替え
        const pinnedSection = document.getElementById('pinnedSection');
        const recentSection = document.getElementById('recentSection');
        const allSection = document.getElementById('allSection');
        if (pinnedSection) pinnedSection.style.display = 'none';
        if (recentSection) recentSection.style.display = 'none';
        if (allSection) allSection.style.display = 'block';
        renderAllFiltered();
    } else {
        // 通常表示: 「イチオシTOP3」+「そのほかのアイテム」
        const allSection = document.getElementById('allSection');
        if (allSection) allSection.style.display = 'none';
        renderRanked();
    }

    // カード描画後にスクロール連動アニメーションを設定
    setupReveal();

    // ヒーローセクションのカウンター（LP表示対象のみ）
    const statEl = document.getElementById('statProducts');
    if (statEl) statEl.textContent = getVisibleProducts().length;
}

// --- 通常表示: TOP3（メダル付き大扱い）+ 残り一覧 ---
// 既存HTMLの pinnedSection / recentSection をそのまま流用し、
// タイトルはJSから書き換える（4カテゴリページのHTML改修を不要にするため）
function renderRanked() {
    const topSection = document.getElementById('pinnedSection');
    const topGrid = document.getElementById('pinnedGrid');
    const restSection = document.getElementById('recentSection');
    const restGrid = document.getElementById('recentGrid');
    if (!topSection || !topGrid) return;

    // 表示対象: ピン留め優先 → 新しい順
    const visible = [...getVisibleProducts()].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.created_at) - new Date(a.created_at);
    });

    // 商品ゼロのカテゴリ: 準備中の空状態を出す
    if (visible.length === 0) {
        topSection.style.display = 'block';
        setSectionHeading(topSection, 'COMING SOON', '');
        topGrid.innerHTML = `
            <div class="empty-state">
                このカテゴリは現在準備中です。<br>
                動画で紹介したアイテムから順次追加していきます。
            </div>`;
        if (restSection) restSection.style.display = 'none';
        return;
    }

    const top3 = visible.slice(0, 3);
    const rest = visible.slice(3);

    topSection.style.display = 'block';
    setSectionHeading(topSection, 'イチオシ TOP3', '迷ったらまずこの3つ。いちばん自信をもっておすすめできるアイテムです。');
    topGrid.innerHTML = top3.map((p, i) => generateProductCardHtml(p, i + 1)).join('');

    if (restSection && restGrid) {
        if (rest.length === 0) {
            restSection.style.display = 'none';
        } else {
            restSection.style.display = 'block';
            setSectionHeading(restSection, 'そのほかの愛用アイテム', '順位はつけていませんが、どれも実際に使い続けているものだけです。');
            restGrid.innerHTML = rest.map(p => generateProductCardHtml(p, 0)).join('');
        }
    }
}

// --- セクションの見出し・説明文をJSから書き換えるヘルパー ---
function setSectionHeading(section, title, desc) {
    const titleEl = section.querySelector('.section-title');
    const descEl = section.querySelector('.section-desc');
    if (titleEl) titleEl.textContent = title;
    if (descEl) {
        descEl.textContent = desc;
        descEl.style.display = desc ? '' : 'none';
    }
}

// --- 全商品リスト（検索・フィルタ時に使用） ---
function renderAllFiltered() {
    const grid = document.getElementById('productsGrid');
    const empty = document.getElementById('emptyState');
    if (!grid || !empty) return;

    // 検索/フィルタ時はLP表示対象のみから検索する
    const visible = getVisibleProducts();
    const filtered = visible.filter(p => {
        if (!FIXED_CATEGORY && currentFilter !== 'all' && p.harm_category !== currentFilter) return false;
        if (searchQuery) {
            const haystack = (p.name + ' ' + p.short_name + ' ' + (p.pain_points || []).join(' ') + ' ' + (p.benefits || []).join(' ')).toLowerCase();
            return haystack.includes(searchQuery);
        }
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '';
        empty.style.display = 'block';
        return;
    }

    empty.style.display = 'none';
    grid.innerHTML = filtered.map(p => generateProductCardHtml(p, 0)).join('');
}

// --- プレミアムカードのHTML生成（共通） ---
// --- 商品IDから決定論的にグラデーションの2色を作る（カード毎に微妙に違う色味） ---
function productGradient(p) {
    const base = CATEGORY_COLORS[p.harm_category] || '#6366f1';
    // idの文字コード合計から -14〜+14度の色相シフトを算出
    let hash = 0;
    const key = p.id || p.name || '';
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    const shift = (Math.abs(hash) % 29) - 14;

    const [h, s, l] = hexToHsl(base);
    const c1 = hslToCss(h + shift, s, Math.min(l + 6, 62));
    const c2 = hslToCss(h + shift + 10, Math.min(s + 8, 90), Math.max(l - 16, 22));
    return { c1, c2 };
}

function hexToHsl(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
    }
    return [h, s * 100, l * 100];
}

function hslToCss(h, s, l) {
    return `hsl(${Math.round((h + 360) % 360)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

// --- カード内で使う共通SVG ---
const SVG_CHECK = '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>';
const SVG_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>';
const SVG_CHEVRON = '<svg class="toggle-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>';
const SVG_MOVIE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M10 9l5 3-5 3z" fill="currentColor" stroke="none"/></svg>';

/**
 * 商品カードHTMLの生成
 * @param p 商品データ
 * @param rank 1〜3ならランキングメダルを表示、0なら通常カード
 */
function generateProductCardHtml(p, rank = 0) {
    const url = getProductUrl(p);
    const color = CATEGORY_COLORS[p.harm_category] || '#6366f1';
    const { c1, c2 } = productGradient(p);

    const displayName = p.display_name || p.short_name || p.name;
    const bannerName = p.short_name || displayName;
    // バナーとタイトルが同一文言なら、本文側のタイトルは省略して重複を防ぐ
    const showTitle = displayName !== bannerName;

    const subtitleHtml = p.subtitle
        ? `<div class="card-subtitle">${escapeHtml(p.subtitle)}</div>`
        : '';

    // --- メタ行: 価格 + 動画紹介バッジ ---
    let metaHtml = '';
    const metaParts = [];
    if (p.price) {
        metaParts.push(`<span class="card-price">&yen;${p.price.toLocaleString()}<span class="price-note">（購入時）</span></span>`);
    }
    if (p.video_count > 0) {
        metaParts.push(`<span class="meta-chip">${SVG_MOVIE}動画で紹介</span>`);
    }
    if (metaParts.length > 0) {
        metaHtml = `<div class="card-meta">${metaParts.join('')}</div>`;
    }

    // --- 推しポイント（ベネフィット先行で購買意欲を先に立ち上げる） ---
    let benefitsHtml = '';
    if (p.benefits && p.benefits.length > 0) {
        const listItems = p.benefits.map(bf =>
            `<li><span class="check-icon">${SVG_CHECK}</span>${escapeHtml(bf)}</li>`
        ).join('');
        benefitsHtml = `<ul class="benefit-list" style="--accent:${color}">${listItems}</ul>`;
    }

    // --- 悩み（折りたたみ: 読みたい人だけ開く。カードの縦圧縮と共感の両立） ---
    let painHtml = '';
    if (p.pain_points && p.pain_points.length > 0) {
        const listItems = p.pain_points.map(pt => `<li>${escapeHtml(pt)}</li>`).join('');
        painHtml = `
            <details class="pain-toggle">
                <summary>こんな悩みがある人へ ${SVG_CHEVRON}</summary>
                <ul>${listItems}</ul>
            </details>
        `;
    }

    // --- 使ってみた本音（運営者アバター付き吹き出し = 信頼の演出） ---
    let commentHtml = '';
    if (p.one_comment) {
        const avatarPath = FIXED_CATEGORY ? '../assets/profile.png' : './assets/profile.png';
        commentHtml = `
            <div class="card-comment">
                <span class="comment-avatar"><img src="${avatarPath}" alt="運営者" loading="lazy"></span>
                <div class="comment-bubble" style="--accent:${color}">
                    <span class="comment-label">使ってみた本音</span>
                    <span class="comment-text">${escapeHtml(p.one_comment)}</span>
                </div>
            </div>
        `;
    }

    // --- CTAボタン群 ---
    let buttonsHtml = '';
    if (p.links) {
        if (p.links.amazon) {
            buttonsHtml += `<a class="card-cta btn-amazon" href="${p.links.amazon}" target="_blank" rel="noopener">Amazonで見る ${SVG_ARROW}</a>`;
        }
        if (p.links.rakuten) {
            buttonsHtml += `<a class="card-cta btn-rakuten" href="${p.links.rakuten}" target="_blank" rel="noopener">楽天市場で見る ${SVG_ARROW}</a>`;
        }
        if (p.links.yahoo) {
            buttonsHtml += `<a class="card-cta btn-yahoo" href="${p.links.yahoo}" target="_blank" rel="noopener">Yahoo!で見る ${SVG_ARROW}</a>`;
        }
        if (p.links.brain) {
            buttonsHtml += `<a class="card-cta btn-brain" href="${p.links.brain}" target="_blank" rel="noopener">Brainで詳細を見る ${SVG_ARROW}</a>`;
        }
        if (p.links.a8) {
            buttonsHtml += `<a class="card-cta btn-a8" href="${p.links.a8}" target="_blank" rel="noopener">公式サイトで詳細を見る ${SVG_ARROW}</a>`;
        }
    }
    if (!buttonsHtml) {
        buttonsHtml = `<a class="card-cta btn-default" href="${url}" target="_blank" rel="noopener">商品詳細を見る ${SVG_ARROW}</a>`;
    }

    // --- リボン（NEW / おすすめ / カテゴリ名） ---
    let ribbonLabel;
    if (rank > 0) {
        ribbonLabel = p.pinned ? '殿堂入り' : 'イチオシ';
    } else if (FIXED_CATEGORY) {
        ribbonLabel = isWithin7Days(p.created_at) ? 'NEW' : '';
    } else {
        ribbonLabel = CATEGORY_LABELS[p.harm_category] || '';
    }
    const ribbonHtml = ribbonLabel ? `<span class="card-ribbon">${ribbonLabel}</span>` : '';

    // --- ランキングメダル（TOP3のみ） ---
    const medalHtml = rank > 0
        ? `<span class="rank-medal rank-${rank}"><span class="rank-no">${rank}</span><span class="rank-label">BEST</span></span>`
        : '';

    return `
        <article class="premium-card reveal">
            <div class="card-visual" style="--c1:${c1};--c2:${c2}">
                ${ribbonHtml}
                ${medalHtml}
                <span class="visual-name">${escapeHtml(bannerName)}</span>
                <span class="card-pr">PR</span>
            </div>
            <div class="card-content">
                ${showTitle ? `<h3 class="card-title">${escapeHtml(displayName)}</h3>` : ''}
                ${subtitleHtml}
                ${metaHtml}
                ${benefitsHtml}
                ${painHtml}
                ${commentHtml}
                <div class="card-cta-group">
                    ${buttonsHtml}
                </div>
                <p class="cta-note">リンク先で最新の価格・在庫をご確認ください</p>
            </div>
        </article>
    `;
}

// --- スクロール連動リビール（カード描画後に毎回呼ぶ） ---
let revealObserver = null;
function setupReveal() {
    if (!('IntersectionObserver' in window)) {
        document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
        return;
    }
    if (!revealObserver) {
        revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in');
                    revealObserver.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    }
    document.querySelectorAll('.reveal:not(.in)').forEach(el => revealObserver.observe(el));
}

// --- 商品のリンクURLを取得（優先順: amazon > rakuten > a8 > moshimo） ---
function getProductUrl(product) {
    if (!product.links) return '#';
    return product.links.amazon
        || product.links.rakuten
        || product.links.a8
        || product.links.moshimo
        || '#';
}

// --- HTMLエスケープ ---
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}
