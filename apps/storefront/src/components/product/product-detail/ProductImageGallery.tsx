import { Button, Center, HStack, Icon, Image, Stack, Text } from "@chakra-ui/react";
import { useState } from "react";
import { TbPhoto } from "react-icons/tb";

type ProductImage = {
  ThumbnailUrl?: string;
  Url: string;
};

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName?: string;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({ images, productName = "Product" }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState(false);
  const activeImage = images[selectedIndex] || images[0];

  return (
    <Stack spacing={4} minW={0}>
      <Center bg="white" h={{ base: "320px", md: "420px", lg: "470px" }} p={{ base: 6, md: 9 }} border="1px solid" borderColor="trade.border" borderRadius="lg" overflow="hidden">
        {!activeImage || error ? <Stack align="center" spacing={3} color="trade.muted"><Icon boxSize={12} as={TbPhoto} aria-hidden /><Text fontSize="sm">Image unavailable</Text></Stack> : <Image w="full" h="full" objectFit="contain" src={activeImage.ThumbnailUrl || activeImage.Url} alt={productName} onError={() => setError(true)} />}
      </Center>
      {images.length > 1 && <HStack spacing={3} overflowX="auto" py={1} px={1}>
        {images.map((image, index) => <Button key={image.Url || index} aria-label={`View ${productName} image ${index + 1}`} aria-pressed={index === selectedIndex} flexShrink={0} w="72px" h="72px" p={2} bg="white" border="2px solid" borderColor={index === selectedIndex ? "trade.ink" : "trade.border"} borderRadius="md" variant="outline" onClick={() => { setSelectedIndex(index); setError(false); }}>
          <Image w="full" h="full" objectFit="contain" src={image.ThumbnailUrl || image.Url} alt="" />
        </Button>)}
      </HStack>}
    </Stack>
  );
};

export default ProductImageGallery;
