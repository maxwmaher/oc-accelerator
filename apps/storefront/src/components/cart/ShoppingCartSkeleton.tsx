import { Grid, Skeleton, Stack, Text } from "@chakra-ui/react";
import { Surface } from "../trade/TradePrimitives";

export default function CartSkeleton() {
  return <Stack spacing={6} w="full" aria-busy="true">
    <Text role="status" color="trade.muted">Loading your cart…</Text>
    <Skeleton h="42px" maxW="340px" borderRadius="md" />
    <Grid templateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(0, 1fr) 360px" }} gap={{ base: 6, xl: 8 }}>
      <Stack spacing={6}><Surface><Skeleton h="150px" borderRadius="md" /></Surface><Surface><Stack spacing={5}><Skeleton h="30px" w="60%" borderRadius="md" /><Skeleton h="80px" borderRadius="md" /><Skeleton h="48px" borderRadius="md" /><Skeleton h="48px" borderRadius="md" /></Stack></Surface></Stack>
      <Surface alignSelf="start"><Stack spacing={5}><Skeleton h="28px" w="70%" borderRadius="md" /><Skeleton h="180px" borderRadius="md" /><Skeleton h="48px" borderRadius="md" /></Stack></Surface>
    </Grid>
  </Stack>;
}
