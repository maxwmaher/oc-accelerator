import { ChakraProvider } from '@chakra-ui/react'
import { OrderCloudProvider, queryClient, useOcForm } from '@ordercloud/react-sdk'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { Tokens, Configuration } from 'ordercloud-javascript-sdk'
import { useRef, type ReactNode } from 'react'
import { FormProvider } from 'react-hook-form'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { resources } from '../src/routes/resources'
import OperationForm from '../src/components/OperationForm'
import { InputControl } from '../src/components/OperationForm/Controls'
import { apiUrl, assignment, clientId, fixtureToken, order, priceSchedule, promotion, spec } from './fixtures'
import { server } from './setup'

beforeEach(() => {
  queryClient.clear()
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } })
  localStorage.clear()
  localStorage.setItem(`OcOpenApi.${apiUrl}`, JSON.stringify(spec))
  Configuration.Set({ baseApiUrl: apiUrl, clientID: clientId, cookieOptions: { prefix: clientId } })
  Tokens.SetAccessToken(fixtureToken())
  server.use(
    http.get(`${apiUrl}/env`, () => HttpResponse.json({ BuildNumber: 'fixture' })),
    http.get(`${apiUrl}/v1/products`, () => HttpResponse.json({ Items: [{ ID: assignment.ProductID }] })),
  )
})
afterEach(() => {
  queryClient.clear()
  Tokens.RemoveAccessToken()
})

function providers(children: ReactNode, path = '/priceschedules/fixture-prices') {
  return <ChakraProvider>
    <OrderCloudProvider baseApiUrl={apiUrl} clientId={clientId} allowAnonymous={false}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/priceschedules/:priceScheduleID" element={children} />
          <Route path="/promotions/:promotionID" element={children} />
          <Route path="/products/:productID" element={children} />
        </Routes>
      </MemoryRouter>
    </OrderCloudProvider>
  </ChakraProvider>
}

function FormWithActions(props: React.ComponentProps<typeof OperationForm>) {
  const submitButtonRef = useRef<HTMLDivElement>(null)
  const discardButtonRef = useRef<HTMLDivElement>(null)
  return <>
    <div ref={submitButtonRef} /><div ref={discardButtonRef} />
    <OperationForm {...props} submitButtonRef={submitButtonRef} discardButtonRef={discardButtonRef} />
  </>
}

describe('the published useOcForm and admin controls', () => {
  it('renders an admin input with the real SDK control (regression for _setDisabledField)', async () => {
    function Boundary() {
      const { methods } = useOcForm('Orders', { body: order, parameters: { direction: 'All', orderID: order.ID } })
      return <FormProvider {...methods}>
        <InputControl name="body.Comments" label="Comments" />
      </FormProvider>
    }
    render(providers(<Boundary />))
    expect(await screen.findByLabelText(/Comments/)).toHaveValue('Pickup order')
  })

  it('keeps disabled inputs disabled without losing values during save and reset', async () => {
    const saved = vi.fn()
    function Boundary() {
      const { methods } = useOcForm('Orders', { body: order, parameters: { direction: 'All', orderID: order.ID } })
      return <FormProvider {...methods}>
        <form noValidate onSubmit={methods.handleSubmit(saved)}>
          <InputControl name="body.ID" label="Order ID" isDisabled />
          <InputControl name="body.Comments" label="Comments" />
          <button type="submit">Submit</button>
          <button type="button" onClick={() => methods.reset()}>Reset</button>
        </form>
      </FormProvider>
    }
    const user = userEvent.setup()
    render(providers(<Boundary />))
    expect(screen.getByLabelText(/Order ID/)).toBeDisabled()
    await user.type(screen.getByLabelText(/Order ID/), 'changed')
    expect(screen.getByLabelText(/Order ID/)).toHaveValue(order.ID)
    await user.type(screen.getByLabelText(/Comments/), ' edited')
    await user.click(screen.getByText('Submit'))
    await waitFor(() => expect(saved).toHaveBeenCalled())
    expect(saved.mock.calls[0][0].body.ID).toBe(order.ID)
    await user.click(screen.getByText('Reset'))
    expect(screen.getByLabelText(/Comments/)).toHaveValue(order.Comments)
  })
})

describe('resource forms with mocked API traffic', () => {
  it('opens /orders/All/:orderID with read-only fields and nested xp data', async () => {
    const writes = vi.fn()
    server.use(
      http.get(`${apiUrl}/v1/orders/All/fixture-order`, () => HttpResponse.json(order)),
      http.put(`${apiUrl}/v1/orders/All/fixture-order`, writes),
    )
    render(<ChakraProvider>
      <OrderCloudProvider baseApiUrl={apiUrl} clientId={clientId} allowAnonymous={false}>
        <MemoryRouter initialEntries={['/orders/All/fixture-order']}>
          <Routes><Route path="/orders/:direction/:orderID"
            element={resources.find(resource => resource.path === '/orders/:direction/:orderID')?.element}
          /></Routes>
        </MemoryRouter>
      </OrderCloudProvider>
    </ChakraProvider>)
    await waitFor(() => expect(screen.getByLabelText(/^ID/)).toHaveValue(order.ID))
    expect(screen.getByLabelText(/^Total/)).toHaveValue('95')
    expect(screen.getByLabelText(/^Location/)).toHaveValue(order.xp.Pickup.Location)
    expect(screen.getByLabelText(/^Code/)).toHaveValue(order.xp.Promotion.Code)
    expect(screen.getAllByLabelText(/^Status/)[1]).toHaveValue('Approved')
    for (const input of screen.getAllByRole('textbox')) expect(input).toHaveAttribute('readonly')
    for (const input of screen.getAllByRole('spinbutton')) expect(input).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument()
    await act(async () => fireEvent.submit(document.getElementById('REQUEST_FORM')!))
    expect(writes).not.toHaveBeenCalled()
  })

  it('edits PriceSchedule quantities and prices, validates, discards and saves', async () => {
    const saved = vi.fn()
    const afterSubmit = vi.fn()
    server.use(http.put(`${apiUrl}/v1/priceschedules/fixture-prices`, async ({ request }) => {
      const body = await request.json()
      saved(body)
      return HttpResponse.json(body)
    }))
    const user = userEvent.setup()
    render(providers(<FormWithActions operationId="PriceSchedules.Save"
      initialValues={{ parameters: { priceScheduleID: priceSchedule.ID }, body: priceSchedule }}
      afterSubmit={afterSubmit} />))
    const saveButton = await screen.findByRole('button', { name: /^Save/ })
    expect(saveButton).toBeDisabled()
    const minimum = screen.getByLabelText(/^Min Quantity/)
    const maximum = screen.getByLabelText(/^Max Quantity/)
    const price = () => screen.getAllByRole('spinbutton', { name: /^Price/ })[0]
    expect(price()).toHaveValue('12.5')
    await user.clear(price())
    await user.type(price(), '13.75')
    await user.tab()
    await user.clear(minimum)
    await user.type(minimum, '2')
    await user.tab()
    await user.clear(maximum)
    await user.type(maximum, '200')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(minimum).toHaveValue('1')
    expect(maximum).toHaveValue('100')
    expect(price()).toHaveValue('12.5')
    // Submit the restored data through the real SDK resolver as well as checking the displayed values.
    await act(async () => fireEvent.submit(document.getElementById('REQUEST_FORM')!))
    await waitFor(() => expect(saved).toHaveBeenCalled())
    expect(saved).toHaveBeenCalledWith(priceSchedule)
    saved.mockClear()
    afterSubmit.mockClear()
    await user.clear(screen.getByLabelText(/^Name/))
    await user.click(saveButton)
    await waitFor(() => expect(screen.getByText('Name is required')).toBeInTheDocument())
    expect(saved).not.toHaveBeenCalled()
    await user.type(screen.getByLabelText(/^Name/), 'Updated prices')
    await user.clear(price())
    await user.type(price(), '13.75')
    await user.tab()
    await user.clear(minimum)
    await user.type(minimum, '2')
    await user.tab()
    await user.clear(maximum)
    await user.type(maximum, '200')
    await user.tab()
    await user.click(saveButton)
    await waitFor(() => expect(saved).toHaveBeenCalledOnce())
    expect(saved).toHaveBeenCalledWith({ ...priceSchedule, Name: 'Updated prices', MinQuantity: 2,
      MaxQuantity: 200, PriceBreaks: [{ Quantity: 1, Price: 13.75 }, { Quantity: 10, Price: 10 }] })
    expect(afterSubmit).toHaveBeenCalledWith(saved.mock.calls[0][0])
  })

  it('preserves promotion fields and opens the independently controlled expression editor', async () => {
    const saved = vi.fn()
    server.use(http.put(`${apiUrl}/v1/promotions/fixture-promo`, async ({ request }) => {
      const body = await request.json()
      saved(body)
      return HttpResponse.json(body)
    }))
    const user = userEvent.setup()
    render(providers(<FormWithActions operationId="Promotions.Save"
      initialValues={{ parameters: { promotionID: promotion.ID }, body: promotion }} />,
      '/promotions/fixture-promo'))
    await screen.findByRole('button', { name: /^Save/ })
    await user.click(screen.getAllByRole('button', { name: 'Expression Builder' })[0])
    expect(await screen.findByRole('dialog')).toHaveTextContent('Promotion Expression Builder')
    expect(screen.getByLabelText(/Line Item Level Promo/)).toBeChecked()
    await user.click(screen.getByLabelText(/Line Item Level Promo/))
    expect(screen.getByLabelText(/Line Item Level Promo/)).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByLabelText(/Line Item Level Promo/)).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByLabelText(/^Eligible Expression/)).toHaveValue(promotion.EligibleExpression)
    await user.clear(screen.getByLabelText(/^Code/))
    await user.type(screen.getByLabelText(/^Code/), 'UPDATED10')
    await user.click(screen.getByRole('button', { name: /^Save/ }))
    await waitFor(() => expect(saved).toHaveBeenCalledWith({ ...promotion, Code: 'UPDATED10' }))
  })

  it('renders, discards and saves an assignment through the SDK assignment mutation', async () => {
    const saved = vi.fn()
    const afterSubmit = vi.fn()
    server.use(http.post(`${apiUrl}/v1/products/assignments`, async ({ request }) => {
      saved(await request.json())
      return new HttpResponse(null, { status: 204 })
    }))
    const user = userEvent.setup()
    render(providers(<FormWithActions operationId="Products.SaveAssignment" isAssignment
      initialValues={{ parameters: {}, body: assignment }} afterSubmit={afterSubmit} />,
      '/products/fixture-product'))
    await screen.findByRole('button', { name: 'Save Assignment' })
    expect(screen.getByText(assignment.ProductID)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/^Quantity/))
    await user.type(screen.getByLabelText(/^Quantity/), '3')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByLabelText(/^Quantity/)).toHaveValue('2')
    await user.clear(screen.getByLabelText(/^Quantity/))
    await user.type(screen.getByLabelText(/^Quantity/), '4')
    await user.tab()
    await user.click(screen.getByRole('button', { name: 'Save Assignment' }))
    await waitFor(() => expect(saved).toHaveBeenCalledWith({ ...assignment, Quantity: 4 }))
    expect(afterSubmit).toHaveBeenCalledWith({ ...assignment, Quantity: 4 })
  })

  it('keeps reader-only permissions read-only and rejects a forced submit', async () => {
    Tokens.SetAccessToken(fixtureToken(['OrderReader']))
    const writes = vi.fn()
    server.use(http.put(`${apiUrl}/v1/priceschedules/fixture-prices`, writes))
    render(providers(<FormWithActions operationId="PriceSchedules.Save"
      initialValues={{ parameters: { priceScheduleID: priceSchedule.ID }, body: priceSchedule }} showReadOnlyFields />))
    expect(await screen.findByLabelText(/^Name/)).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: /^Save/ })).not.toBeInTheDocument()
    await act(async () => fireEvent.submit(document.getElementById('REQUEST_FORM')!))
    expect(writes).not.toHaveBeenCalled()
  })
})
