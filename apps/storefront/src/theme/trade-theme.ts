/** KFMB demo identity. Pure theme data; do not import commerce SDKs here. */
const field = {
  bg: "white", borderColor: "trade.border", rounded: "md", borderRadius: "md", minH: "44px",
  _hover: { borderColor: "trade.muted" },
  _focusVisible: { borderColor: "trade.ink", boxShadow: "0 0 0 2px #B38A43" },
  _invalid: { borderColor: "red.600", boxShadow: "0 0 0 1px var(--chakra-colors-red-600)" },
};
const tradeTheme = {
  colors: {
    trade: { ink: "#142D3B", ivory: "#F6F4EF", gold: "#B38A43", border: "#DDDCD4", muted: "#53636B", surface: "#FFFFFF" },
  },
  fonts: {
    heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Consolas, monospace',
  },
  radii: { sm: "6px", md: "8px", lg: "12px", xl: "14px" },
  semanticTokens: { colors: {
    "chakra-body-bg": { default: "trade.ivory", _light: "trade.ivory", _dark: "trade.ivory" },
    "chakra-subtle-bg": { default: "trade.ivory", _light: "trade.ivory", _dark: "trade.ivory" },
    "chakra-body-text": { default: "#26343B", _light: "#26343B", _dark: "#26343B" },
    "chakra-subtle-text": { default: "trade.muted", _light: "trade.muted", _dark: "trade.muted" },
    "chakra-placeholder-color": { default: "trade.muted", _light: "trade.muted", _dark: "trade.muted" },
    "chakra-border-color": { default: "trade.border", _light: "trade.border", _dark: "trade.border" },
  } },
  styles: { global: {
    body: { bg: "trade.ivory", color: "#26343B", lineHeight: "1.6", fontVariantNumeric: "tabular-nums" },
    "#root": { minHeight: "100dvh" },
    "h1, h2, h3, h4": { color: "trade.ink", overflowWrap: "anywhere" },
    "a, button, input, select, textarea": { touchAction: "manipulation" },
    ":focus-visible": { outline: "2px solid #B38A43", outlineOffset: "3px" },
    "@media (prefers-reduced-motion: reduce)": { "*, *::before, *::after": { animation: "none !important", transition: "none !important", scrollBehavior: "auto !important" } },
  } },
  components: {
    Heading: { baseStyle: { color: "trade.ink", fontWeight: "700", letterSpacing: "-.025em", lineHeight: "1.2" } },
    Button: {
      baseStyle: { rounded: "md", borderRadius: "md", fontWeight: "600", whiteSpace: "normal", _focusVisible: { boxShadow: "0 0 0 3px #B38A43" }, _disabled: { opacity: .5, cursor: "not-allowed" } },
      sizes: { xs: { minH: "40px", px: 3, fontSize: "sm" }, sm: { minH: "44px", px: 4, fontSize: "sm" }, md: { minH: "48px", px: 5 }, lg: { minH: "52px", px: 6 } },
      variants: {
        solid: { bg: "primary.500", color: "white", _hover: { bg: "primary.600", _disabled: { bg: "primary.500" } }, _active: { bg: "primary.700" } },
        outline: { bg: "white", color: "trade.ink", border: "1px solid", borderColor: "trade.border", _hover: { bg: "trade.ivory", borderColor: "trade.ink" }, _active: { bg: "trade.ivory" } },
        ghost: { color: "trade.ink", _hover: { bg: "trade.ivory" }, _active: { bg: "trade.ivory" } },
        link: { color: "trade.ink", textUnderlineOffset: "3px", _hover: { textDecoration: "underline" } },
      },
      defaultProps: { colorScheme: "primary" },
    },
    Input: { variants: { outline: { field } }, defaultProps: { focusBorderColor: "trade.ink" } },
    Select: { variants: { outline: { field } } },
    NumberInput: { baseStyle: { field, stepper: { borderColor: "trade.border", color: "trade.ink" } }, variants: { outline: { field } } },
    Textarea: { variants: { outline: field } },
    FormLabel: { baseStyle: { fontSize: "sm", fontWeight: "600", color: "trade.ink", mb: 2 } },
    Card: { baseStyle: { container: { bg: "white", borderRadius: "lg", border: "1px solid", borderColor: "trade.border", boxShadow: "0 2px 8px rgba(20,45,59,.035)" } }, variants: { levitating: { container: { _hover: { transform: "none", boxShadow: "sm", borderColor: "trade.gold" }, _focusWithin: { transform: "none" } } } } },
    Alert: { baseStyle: { container: { borderRadius: "md", alignItems: "flex-start", fontSize: "sm" } } },
    Modal: { baseStyle: { dialog: { bg: "trade.ivory", borderRadius: "xl" } } },
    Tabs: { variants: { enclosed: { tab: { fontSize: "md", minH: "48px", _selected: { color: "trade.ink", bg: "white", borderColor: "trade.border", borderBottomColor: "white" } }, tablist: { borderColor: "trade.border" } } } },
    Link: { baseStyle: { color: "trade.ink", textUnderlineOffset: "3px" } },
  },
};
export default tradeTheme;
