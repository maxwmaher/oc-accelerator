import { Box, Flex, Heading, Image, Stack, Text, type BoxProps, type StackProps } from "@chakra-ui/react";
import { BRAND_LOGO_DARK, BRAND_LOGO_LIGHT } from "../../constants";

/** Presentational only: safe outside Router and without loading the commerce SDK. */
export function TradeBrand() {
  const logo = BRAND_LOGO_LIGHT || BRAND_LOGO_DARK;
  return logo ? <Image src={logo} alt="Customer brand" maxH="52px" maxW="180px" objectFit="contain" /> : (
    <Flex align="center" gap={3} color="trade.ink">
      <Box borderLeft="3px solid" borderColor="trade.gold" pl={3}>
        <Text fontSize="2xl" lineHeight="1" fontWeight="800" letterSpacing=".08em">KFMB</Text>
        <Text fontSize="sm" mt={1} fontWeight="500" letterSpacing=".02em">Trade ordering</Text>
      </Box>
    </Flex>
  );
}

export function TradeFooter() {
  return <Box as="footer" borderTop="1px solid" borderColor="trade.border" mt="auto" bg="trade.ivory">
    <Flex maxW="1320px" mx="auto" px={{ base: 4, md: 6, xl: 8 }} py={5} gap={3} flexWrap="wrap" justify="space-between" color="trade.muted" fontSize="sm">
      <Text>KFMB · Trade ordering</Text><Text>OrderCloud customer demo · © {new Date().getFullYear()} Sitecore</Text>
    </Flex>
  </Box>;
}

export function PageIntro({ title, children, ...props }: StackProps & { title: string }) {
  return <Stack spacing={2} mb={{ base: 6, md: 8 }} {...props}><Heading as="h1" size={{ base: "xl", md: "2xl" }}>{title}</Heading>{children && <Box color="trade.muted" maxW="68ch">{children}</Box>}</Stack>;
}

export function Surface(props: BoxProps) {
  return <Box bg="white" border="1px solid" borderColor="trade.border" borderRadius="lg" p={{ base: 5, md: 7 }} {...props} />;
}

export function DemoNotice(props: BoxProps) {
  return <Box bg="trade.ivory" borderLeft="3px solid" borderColor="trade.gold" p={4} borderRadius="md" fontSize="sm" color="trade.muted" lineHeight="tall" {...props} />;
}
