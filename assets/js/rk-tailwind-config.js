/* ============================================================
   rk-tailwind-config.js —— 全站唯一 Tailwind 配置来源（TASK-021-A）
   位置：<script src="/assets/js/tailwind.js"></script> 之后加载
   颜色形式：一律 rgb(var(--rk-*-rgb) / <alpha-value>)
   —— 既支持非透明度类（/1 输出），也让 /20 /30 /50 /60 等透明度
   修饰符生成有效 CSS（var(hex) 直接加 alpha 会失效，此为唯一可靠形式）。
   未覆盖的 shade 走 Tailwind 内置原值，保证深色外观零变化。
   ============================================================ */
tailwind.config = {
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                primary: 'rgb(var(--rk-primary-rgb) / <alpha-value>)',
                'primary-hi': 'rgb(var(--rk-primary-hi-rgb) / <alpha-value>)',
                darkbg: 'rgb(var(--rk-bg-rgb) / <alpha-value>)',
                cardbg: 'rgb(var(--rk-card-rgb) / <alpha-value>)',
                textlight: 'rgb(var(--rk-text-rgb) / <alpha-value>)',
                /* 内置 white（text-white 337 处/bg-white 26 处）→ 标题令牌 */
                white: 'rgb(var(--rk-title-rgb) / <alpha-value>)',
                /* 中性灰 → 语义令牌（原值一致，浅色模式整体可切换） */
                gray: {
                    300: 'rgb(var(--rk-text-soft-rgb) / <alpha-value>)',
                    400: 'rgb(var(--rk-text-dim-rgb) / <alpha-value>)',
                    500: 'rgb(var(--rk-text-mute-rgb) / <alpha-value>)',
                    600: 'rgb(var(--rk-text-faint-rgb) / <alpha-value>)',
                    700: 'rgb(var(--rk-border-rgb) / <alpha-value>)',
                    800: 'rgb(var(--rk-surface-1-rgb) / <alpha-value>)'
                },
                /* 功能色：只覆盖与令牌原值相等的 shade，其余 shade 保留内置 */
                green:  { 400: 'rgb(var(--rk-ok-rgb) / <alpha-value>)' },
                amber:  { 400: 'rgb(var(--rk-warn-rgb) / <alpha-value>)' },
                red:    { 400: 'rgb(var(--rk-err-rgb) / <alpha-value>)' },
                cyan:   { 400: 'rgb(var(--rk-info-rgb) / <alpha-value>)' },
                purple: { 400: 'rgb(var(--rk-accent-2-rgb) / <alpha-value>)' },
                blue:   { 400: 'rgb(var(--rk-primary-hi-rgb) / <alpha-value>)',
                          500: 'rgb(var(--rk-primary-rgb) / <alpha-value>)' }
            },
            fontFamily: {
                mono: ['"Cascadia Mono"', '"Cascadia Code"', 'Consolas', '"Microsoft YaHei"', '"微软雅黑"', '"PingFang SC"', 'monospace']
            },
            /* 8 页 @apply hover:shadow-lg hover:shadow-primary/20 依赖（历史遗留类，
               不配 boxShadowColor 会导致 Play CDN 编译 CssSyntaxError、全站类不生成） */
            boxShadowColor: {
                primary: 'rgb(var(--rk-primary-rgb) / <alpha-value>)',
                'primary-hi': 'rgb(var(--rk-primary-hi-rgb) / <alpha-value>)'
            }
        }
    }
};
