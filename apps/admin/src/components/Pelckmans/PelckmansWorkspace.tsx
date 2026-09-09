import {
  Alert,
  AlertIcon,
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Container,
  Divider,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  Input,
  NumberInput,
  NumberInputField,
  Radio,
  RadioGroup,
  Select,
  SimpleGrid,
  Spinner,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useToast,
} from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError, CatalogItem, Component, Document, Offer, OfferType } from './api'

const templates: {
  type: OfferType
  title: string
  description: string
}[] = [
  {
    type: 'Bundle',
    title: 'Book & event bundle',
    description: 'Package books with events or signing experiences.',
  },
  {
    type: 'BuyThreePayTwo',
    title: 'Buy 3, pay 2',
    description: 'Give one cheapest qualifying book free.',
  },
  {
    type: 'SegmentDiscount',
    title: 'Author or genre discount',
    description: 'Reward a minimum quantity from one author or genre.',
  },
]

const eur = (n: number) =>
  new Intl.NumberFormat('nl-BE', {
    style: 'currency',
    currency: 'EUR',
  }).format(n)

const friendlyFacetLabel = (id: string, name: string, selectorType: string) => {
  const technicalPattern = /^PEL_(AUTHOR|GENRE)_([A-Z0-9]+(?:[_-][A-Z0-9]+)*)$/i
  const humanize = (value: string) => {
    const match = technicalPattern.exec(value.trim())
    if (!match || match[1].toLowerCase() !== selectorType.toLowerCase()) return

    return match[2]
      .split(/[_-]/)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
      .join(' ')
  }
  const cleanName = name.trim()

  if (cleanName && cleanName.toLowerCase() !== id.trim().toLowerCase()) {
    return humanize(cleanName) || cleanName
  }

  return humanize(id)
}

const offerSummary = (offer: Offer, audienceLabel?: string) => {
  if (offer.type !== 'SegmentDiscount' || !offer.rule) {
    return templates.find((template) => template.type === offer.type)?.description
  }

  const selector = offer.rule.selectorType.toLowerCase()
  const fallback = selector === 'author' || selector === 'genre'
    ? `the selected ${selector}`
    : 'the selected books'
  const audience = audienceLabel || fallback

  return `Buy ${offer.rule.minimumQuantity}+ books from ${audience} and save ${offer.rule.discountPercent}%.`
}

export default function PelckmansWorkspace({
  mode,
}: {
  mode?: 'new' | 'detail' | 'review'
}) {
  const [docs, setDocs] = useState<Document[]>([])
  const [detailDoc, setDetailDoc] = useState<Document>()
  const [detailUnavailable, setDetailUnavailable] = useState(false)
  const [caps, setCaps] = useState<{
    username: string
    editor: boolean
    approver: boolean
  }>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  const { offerId } = useParams()

  useEffect(() => {
    setBusy(true)
    setError('')
    setDetailUnavailable(false)
    if (offerId) setDetailDoc(undefined)
    const requestedDocument = offerId ? api.get(offerId) : api.list()

    Promise.all([api.capabilities(), requestedDocument])
      .then(([c, result]) => {
        setCaps(c)
        if (offerId) {
          setDetailDoc(result as Document)
        } else {
          setDocs(result as Document[])
        }
      })
      .catch((e) => {
        if (offerId && e instanceof ApiError && (e.status === 403 || e.status === 404)) {
          setDetailUnavailable(true)
        } else {
          setError((e as Error).message)
        }
      })
      .finally(() => setBusy(false))
  }, [offerId])

  if (busy) {
    return (
      <Container py="10">
        <Spinner />
      </Container>
    )
  }

  if (error) {
    return (
      <Container py="10">
        <Alert status="error">
          <AlertIcon />
          {error}
        </Alert>
      </Container>
    )
  }

  if (mode === 'new') {
    return <Wizard />
  }

  if (offerId) {
    return detailDoc ? (
      <OfferDetail
        initial={detailDoc}
        editor={!!caps?.editor}
        approver={!!caps?.approver}
        username={caps?.username || ''}
      />
    ) : detailUnavailable ? (
      <Container py="10">
        <Alert status="warning">
          <AlertIcon />
          Offer not found or not available.
        </Alert>
      </Container>
    ) : null
  }

  const review = docs.filter(
    (x) => x.offer.status === 'PendingApproval'
  )

  return (
    <Container maxW="7xl" py="8">
      <HStack justify="space-between">
        <Box>
          <Heading>Bundles &amp; Offers</Heading>
          <Text color="gray.600">
            Create customer-ready Pelckmans packages and promotions through a
            governed approval workflow.
          </Text>
        </Box>

        {caps?.editor && (
          <Button
            as={Link}
            to="/pelckmans/new"
            colorScheme="blue"
          >
            Create bundle or offer
          </Button>
        )}
      </HStack>

      <Heading size="md" mt="10" mb="4">
        Start with a template
      </Heading>

      <SimpleGrid
        columns={{ base: 1, md: 3 }}
        spacing="5"
      >
        {templates.map((t) => (
          <Card key={t.type}>
            <CardBody>
              <Heading size="sm">{t.title}</Heading>
              <Text my="3">{t.description}</Text>

              {caps?.editor && (
                <Button
                  as={Link}
                  to={`/pelckmans/new?type=${t.type}`}
                  size="sm"
                >
                  Use template
                </Button>
              )}
            </CardBody>
          </Card>
        ))}
      </SimpleGrid>

      <Heading size="md" mt="10" mb="4">
        Saved offers
      </Heading>

      <OfferTable docs={docs} />

      {caps?.approver && (
        <>
          <Heading size="md" mt="10" mb="4">
            Review queue <Badge>{review.length}</Badge>
          </Heading>

          <OfferTable
            docs={review}
            review
          />
        </>
      )}
    </Container>
  )
}

function OfferTable({
  docs,
  review,
}: {
  docs: Document[]
  review?: boolean
}) {
  return docs.length ? (
    <Table variant="simple">
      <Thead>
        <Tr>
          <Th>Offer</Th>
          <Th>Type</Th>
          <Th>Status</Th>
          <Th>Owner</Th>
          <Th>Last update</Th>
          <Th />
        </Tr>
      </Thead>

      <Tbody>
        {docs.map((d) => (
          <Tr key={d.offer.id}>
            <Td fontWeight="semibold">
              {d.offer.name}
            </Td>

            <Td>
              {templates.find(
                (t) => t.type === d.offer.type
              )?.title}
            </Td>

            <Td>
              <Badge>{d.offer.status}</Badge>
            </Td>

            <Td>{d.offer.owner}</Td>

            <Td>
              {new Date(
                d.offer.updatedAt
              ).toLocaleString()}
            </Td>

            <Td>
              <Button
                as={Link}
                to={`/pelckmans/offers/${d.offer.id}${
                  review ? '/review' : ''
                }`}
                size="xs"
              >
                {review ? 'Review' : 'Open'}
              </Button>
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  ) : (
    <Text color="gray.500">
      No offers here yet.
    </Text>
  )
}

function Wizard() {
  const query = new URLSearchParams(location.search)
  const [step,setStep]=useState(1); const [type,setType]=useState<OfferType>((query.get('type') as OfferType)||'Bundle')
  const [name,setName]=useState(''); const [items,setItems]=useState<CatalogItem[]>([]); const [selected,setSelected]=useState<Component[]>([])
  const [facets,setFacets]=useState<{authors:{id:string;name:string}[];genres:{id:string;name:string}[]}>({authors:[],genres:[]});const [selectorType,setSelectorType]=useState('author');const [selector,setSelector]=useState('')
  const [minimum,setMinimum]=useState(4);const [percent,setPercent]=useState(10);const [search,setSearch]=useState('');const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('')
  const nav=useNavigate();const toast=useToast()
  const discover=async()=>{setLoading(true);try{const x=await api.catalog(search);setItems(x.items);setFacets({authors:x.authors,genres:x.genres});setError(x.items.length?'':'No customer-visible catalog products were found. Check buyer/catalog and shopper configuration.')}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  // Catalog reload is intentionally triggered once; Search invokes the current query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{void discover()},[])
  const toggle=(x:CatalogItem)=>setSelected(v=>v.some(c=>c.productId===x.id)?v.filter(c=>c.productId!==x.id):[...v,{productId:x.id,title:x.name,quantity:1,unitPrice:x.unitPrice??-1,includedFree:false,required:true}])
  const save=async()=>{setSaving(true);try{const eligible=selected.map(x=>x.productId);const d=await api.create({name,type,components:selected,rule:type==='Bundle'?undefined:{selectorType,selectorId:selector,minimumQuantity:type==='BuyThreePayTwo'?3:minimum,discountPercent:type==='BuyThreePayTwo'?0:percent,productIds:eligible}});toast({status:'success',title:'Draft saved'});nav(`/pelckmans/offers/${d.offer.id}`)}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
  return <Container maxW="5xl" py="8"><Heading size="lg">Create bundle or offer</Heading><Text color="gray.500">Step {step} of 4 · {['Choose a template','Select real catalog items','Configure pricing and conditions','Preview and save'][step-1]}</Text><Divider my="6"/>{error&&<Alert status="error" mb="4"><AlertIcon/>{error}</Alert>}
   {step===1&&<RadioGroup value={type} onChange={x=>{setType(x as OfferType);setSelected([])}}><Stack>{templates.map(t=><Card key={t.type} variant="outline"><CardBody><Radio value={t.type}><b>{t.title}</b><Text>{t.description}</Text></Radio></CardBody></Card>)}</Stack></RadioGroup>}
   {step===2&&<Stack><HStack><Input aria-label="Catalog search" placeholder="Search books, events or signings" value={search} onChange={e=>setSearch(e.target.value)}/><Button isLoading={loading} onClick={discover}>Search</Button></HStack>{items.map(x=><Card key={x.id} variant="outline"><CardBody><Checkbox isChecked={selected.some(c=>c.productId===x.id)} isDisabled={x.unitPrice==null} onChange={()=>toggle(x)}><b>{x.name}</b> · {x.entityType} · {x.unitPrice==null?'Price unavailable':eur(x.unitPrice)} {x.availability&&`· ${x.availability}`}</Checkbox></CardBody></Card>)}</Stack>}
   {step===3&&<Stack><FormControl isRequired><FormLabel>Offer name</FormLabel><Input value={name} maxLength={100} onChange={e=>setName(e.target.value)}/></FormControl>{type==='Bundle'?selected.map((x,i)=><Card key={x.productId}><CardBody><b>{x.title}</b><HStack><FormControl><FormLabel>Quantity</FormLabel><NumberInput min={1} max={99} value={x.quantity} onChange={(_,n)=>setSelected(v=>v.map((c,j)=>j===i?{...c,quantity:n}:c))}><NumberInputField/></NumberInput></FormControl><Checkbox isChecked={x.required} onChange={e=>setSelected(v=>v.map((c,j)=>j===i?{...c,required:e.target.checked}:c))}>Required</Checkbox><Checkbox isChecked={x.includedFree} onChange={e=>setSelected(v=>v.map((c,j)=>j===i?{...c,includedFree:e.target.checked}:c))}>Included free</Checkbox></HStack></CardBody></Card>):<><HStack><Select value={selectorType} onChange={e=>{setSelectorType(e.target.value);setSelector('')}}><option value="author">Author</option><option value="genre">Genre</option><option value="category">Selected books</option></Select><Select value={selector} onChange={e=>setSelector(e.target.value)} placeholder="Choose audience">{(selectorType==='author'?facets.authors:selectorType==='genre'?facets.genres:[{id:'selected-books',name:'Selected books'}]).map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</Select></HStack>{type==='SegmentDiscount'&&<HStack><FormControl><FormLabel>Minimum quantity</FormLabel><NumberInput min={2} max={99} value={minimum} onChange={(_,n)=>setMinimum(n)}><NumberInputField/></NumberInput></FormControl><FormControl><FormLabel>Discount %</FormLabel><NumberInput min={1} max={50} value={percent} onChange={(_,n)=>setPercent(n)}><NumberInputField/></NumberInput></FormControl></HStack>}</>}</Stack>}
   {step===4&&<Card><CardBody><Badge colorScheme="orange">Estimated preview</Badge><Heading size="md">{name||'Untitled offer'}</Heading>{selected.length?selected.map(x=><Text key={x.productId}>{x.quantity} × {x.title}: {eur(x.unitPrice)}{x.includedFree?' · included free':''}</Text>):<Alert status="warning"><AlertIcon/>Select products before submitting this draft.</Alert>}<Text fontWeight="bold">Package/sample subtotal: {eur(selected.reduce((n,x)=>n+(x.includedFree?0:x.unitPrice*x.quantity),0))}</Text></CardBody></Card>}
   <HStack mt="8" justify="space-between"><Button onClick={()=>step===1?nav('/pelckmans'):setStep(step-1)}>{step===1?'Cancel':'Back'}</Button>{step<4?<Button colorScheme="blue" isDisabled={step===2&&selected.length===0} onClick={()=>setStep(step+1)}>Next</Button>:<Button colorScheme="blue" isLoading={saving} isDisabled={!name.trim()} onClick={save}>Save draft</Button>}</HStack></Container>
}
function OfferDetail({
  initial,
  editor,
  approver,
  username,
}: {
  initial: Document
  editor: boolean
  approver: boolean
  username: string
}) {
  const [doc, setDoc] =
    useState(initial)

  const [preview, setPreview] =
    useState<
      Awaited<
        ReturnType<typeof api.preview>
      >
    >()

  const [comment, setComment] =
    useState('')

  const [error, setError] =
    useState('')
  const [editing,setEditing]=useState(false)
  const [draftName,setDraftName]=useState(initial.offer.name)
  const [draftComponents,setDraftComponents]=useState(initial.offer.components)
  const [verification,setVerification]=useState<Awaited<ReturnType<typeof api.verify>>>()
  const [working,setWorking]=useState(false)
  const [audienceLabel,setAudienceLabel]=useState<string>()

  useEffect(() => {
    const rule = initial.offer.rule
    if (!rule || (rule.selectorType !== 'author' && rule.selectorType !== 'genre')) return

    let active = true
    api.catalog().then((catalog) => {
      const facets = rule.selectorType === 'author' ? catalog.authors : catalog.genres
      const facet = facets.find((candidate) => candidate.id === rule.selectorId)
      const label = facet && friendlyFacetLabel(facet.id, facet.name, rule.selectorType)
      if (active && label) setAudienceLabel(label)
    }).catch(() => {
      // The offer remains usable with friendly fallback wording when facets are unavailable.
    })

    return () => { active = false }
  }, [initial.offer.rule])

  const act = async (a: string) => {
    if(working)return
    setWorking(true)
    try {
      setDoc(
        await api.action(
          doc.offer.id,
          a,
          doc.eTag,
          comment
        )
      )
      setError('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setWorking(false)
    }
  }

  const o = doc.offer

  return (
    <Container maxW="5xl" py="8">
      <HStack justify="space-between">
        <Box>
          <Badge>{o.status}</Badge>
          <Heading>{o.name}</Heading>
          <Text>
            Owned by {o.owner} · revision{' '}
            {o.revision}
          </Text>
        </Box>

        <Button
          as={Link}
          to="/pelckmans"
        >
          Back to workspace
        </Button>
      </HStack>

      {error && (
        <Alert status="error" mt="4">
          <AlertIcon />
          {error}
        </Alert>
      )}

      <Card mt="6">
        <CardBody>
          <Heading size="md">
            Plain-language summary
          </Heading>

          <Text mt="2">
            {offerSummary(o, audienceLabel)}
          </Text>

          {o.publicationError && (
            <Alert
              status="error"
              mt="4"
            >
              <AlertIcon />
              Publication did not complete:{' '}
              {o.publicationError}
            </Alert>
          )}
        </CardBody>
      </Card>

      <HStack mt="5">
        {o.status==='Draft'&&editor&&o.owner.toLowerCase()===username.toLowerCase()&&<Button onClick={()=>setEditing(!editing)}>{editing?'Cancel edit':'Edit draft'}</Button>}
        {o.status === 'Draft' && (
          <>
            <Button
              onClick={async () =>
                setPreview(
                  await api.preview(o.id)
                )
              }
            >
              Estimated preview
            </Button>

            {editor && (
              <Button
                colorScheme="blue"
                isLoading={working}
                onClick={() =>
                  act('submit')
                }
              >
                Submit for approval
              </Button>
            )}
          </>
        )}

        {approver &&
          o.status ===
            'PendingApproval' && (
            <>
              <Button
                colorScheme="green"
                onClick={() =>
                  act('approve')
                }
              >
                Approve exact revision
              </Button>

              <Input
                placeholder="Required rejection comment"
                value={comment}
                onChange={(e) =>
                  setComment(
                    e.target.value
                  )
                }
              />

              <Button
                colorScheme="red"
                isDisabled={
                  !comment.trim()
                }
                onClick={() =>
                  act('reject')
                }
              >
                Reject
              </Button>
            </>
          )}

        {approver &&
          (o.status === 'Approved' || o.status === 'PublishFailed') && (
            <Button
              colorScheme="blue"
              isLoading={working}
              onClick={() =>
                act('publish')
              }
            >
              {o.status==='PublishFailed'?'Retry publication':'Publish to OrderCloud'}
            </Button>
          )}

        {approver&&o.status === 'Published' && <Button isLoading={working} onClick={async()=>{setWorking(true);try{setVerification(await api.verify(o.id,o.components));setError('')}catch(e){setError((e as Error).message)}finally{setWorking(false)}}}>Verify in OrderCloud</Button>}
        {editor&&(o.status==='PublishFailed'||o.status==='Published')&&<Button onClick={async()=>{try{const x=await api.duplicate(o.id);location.assign(`/pelckmans/offers/${x.offer.id}`)}catch(e){setError((e as Error).message)}}}>Duplicate as draft</Button>}
      </HStack>

      {editing&&<Card mt="5"><CardBody><Heading size="sm">Edit saved draft</Heading><FormControl mt="3"><FormLabel>Name</FormLabel><Input value={draftName} onChange={e=>setDraftName(e.target.value)}/></FormControl>{draftComponents.map((x,i)=><HStack key={x.productId} mt="3"><Text flex="1">{x.title}</Text><NumberInput width="24" min={1} max={99} value={x.quantity} onChange={(_,n)=>setDraftComponents(v=>v.map((c,j)=>j===i?{...c,quantity:n}:c))}><NumberInputField/></NumberInput><Checkbox isChecked={x.includedFree} onChange={e=>setDraftComponents(v=>v.map((c,j)=>j===i?{...c,includedFree:e.target.checked}:c))}>Free</Checkbox></HStack>)}<Button mt="4" colorScheme="blue" isLoading={working} onClick={async()=>{setWorking(true);try{const x=await api.update(o.id,{eTag:doc.eTag,name:draftName,components:draftComponents,rule:o.rule});setDoc(x);setEditing(false);setError('')}catch(e){setError((e as Error).message)}finally{setWorking(false)}}}>Save changes</Button></CardBody></Card>}

      {preview && (
        <Card mt="5">
          <CardBody>
            <Badge colorScheme="orange">
              {preview.label}
            </Badge>

            {preview.lines.map(
              (l, i) => (
                <Text key={i}>
                  {l.quantity} × {l.title}:{' '}
                  {eur(l.unitPrice)}{' '}
                  {l.discount > 0 &&
                    `− ${eur(
                      l.discount
                    )}`}
                </Text>
              )
            )}

            <Heading size="sm" mt="3">
              Payable:{' '}
              {eur(preview.payable)}
            </Heading>
          </CardBody>
        </Card>
      )}

      {verification&&<Card mt="5"><CardBody><Badge colorScheme={verification.discrepancies.length?'red':'green'}>Native OrderCloud verification</Badge>{verification.lines.map((x,i)=><Text key={`${x.productId}-${i}`}>{x.quantity} × {x.title} at {eur(x.unitPrice)} = {eur(x.lineTotal)}{x.discount?` · discount ${eur(x.discount)}`:''}</Text>)}<Heading size="sm">Actual total: {eur(verification.total)} · discount {eur(verification.discount)}</Heading><Text>Applied promotions: {[...new Set(verification.appliedPromotions)].join(', ')||'none'}</Text>{verification.discrepancies.map(x=><Alert status="error" key={x}><AlertIcon/>{x}</Alert>)}<Box as="details" mt="3"><Box as="summary">Technical identifiers</Box><Text fontFamily="mono">Order {verification.orderId}</Text>{Object.entries(verification.resourceIds).map(([k,v])=><Text key={k} fontFamily="mono">{k}: {v}</Text>)}</Box></CardBody></Card>}

      <Heading size="sm" mt="8">
        Audit history
      </Heading>

      {o.history.map((h, i) => (
        <Text key={i}>
          {new Date(
            h.at
          ).toLocaleString()}{' '}
          · {h.actor} · {h.action}
          {h.comment &&
            `: ${h.comment}`}
        </Text>
      ))}
    </Container>
  )
}
