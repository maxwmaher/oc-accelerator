import { extendTheme } from "@chakra-ui/react";
import sitecoreTheme from "@sitecore/blok-theme";
import components from "./components/index";
import foundations from "./foundations/index";
import layerStyles from "./layer-styles";
import semanticTokens from "./semantic-tokens";
import styles from "./styles";
import tradeTheme from "./trade-theme";

const acceleratorTheme = extendTheme(
  sitecoreTheme,
  {
    config: {
      initialColorMode: "light",
      // initialColorMode: "system",
      // useSystemColorMode: true,
    },
    ...foundations,
    components,
    styles,
    layerStyles,
    semanticTokens,
  },
  tradeTheme
);

export default acceleratorTheme;
