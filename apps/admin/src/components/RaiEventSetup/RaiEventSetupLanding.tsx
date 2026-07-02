import { ArrowForwardIcon } from '@chakra-ui/icons'
import { Button, Card, CardBody, Container, HStack, Heading, SimpleGrid, Stack, Text } from '@chakra-ui/react'
import { FC } from 'react'
import { Link } from 'react-router-dom'

const RaiEventSetupLanding: FC = () => {
  return (
    <Container maxW="6xl" p={8}>
      <Stack spacing={3} mb={8}>
        <Text color="blue.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          Demo experience
        </Text>
        <Heading as="h1" size="xl" color="chakra-subtle-text">
          RAI Event Setup
        </Heading>
        <Text maxW="3xl" color="chakra-subtle-text" fontSize="lg">
          Guided daily workflows for ecommerce and admin teams preparing event websites, reusable products, exhibitor buyers, and event-specific pricing.
        </Text>
      </Stack>
      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={6}>
        <Card variant="outline" p={2} _hover={{ borderColor: 'blue.300', boxShadow: 'md' }}>
          <CardBody>
            <Stack spacing={4} align="flex-start">
              <Heading as="h2" size="md">Create Event Product</Heading>
              <Text color="chakra-subtle-text">
                Create a reusable Pizza product, configure business fields, product options, pricing for this event, and product availability across event websites.
              </Text>
              <HStack color="chakra-subtle-text" fontSize="sm" flexWrap="wrap">
                <Text>Basics</Text><Text>•</Text><Text>Pricing</Text><Text>•</Text><Text>Options</Text><Text>•</Text><Text>Availability</Text>
              </HStack>
              <Button as={Link} to="/rai-event-setup/products/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />}>
                Start product setup
              </Button>
            </Stack>
          </CardBody>
        </Card>
        <Card variant="outline" p={2} _hover={{ borderColor: 'blue.300', boxShadow: 'md' }}>
          <CardBody>
            <Stack spacing={4} align="flex-start">
              <Heading as="h2" size="md">Register Exhibitor Buyer</Heading>
              <Text color="chakra-subtle-text">
                Register a new exhibitor buyer user, relate them to an event, and grant exhibitor access to products and pricing for that event website.
              </Text>
              <HStack color="chakra-subtle-text" fontSize="sm" flexWrap="wrap">
                <Text>Event</Text><Text>•</Text><Text>Company</Text><Text>•</Text><Text>User</Text><Text>•</Text><Text>Access</Text>
              </HStack>
              <Button as={Link} to="/rai-event-setup/buyers/new" colorScheme="blue" rightIcon={<ArrowForwardIcon />}>
                Start buyer setup
              </Button>
            </Stack>
          </CardBody>
        </Card>
      </SimpleGrid>
    </Container>
  )
}

export default RaiEventSetupLanding
