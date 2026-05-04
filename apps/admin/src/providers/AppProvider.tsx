import { FC, useCallback, useEffect } from 'react'
import axios, { AxiosError } from 'axios'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { IOrderCloudErrorContext, OrderCloudProvider } from '@ordercloud/react-sdk'
import {
  ALLOW_ANONYMOUS,
  BASE_API_URL,
  CLIENT_ID,
  CUSTOM_SCOPE,
  SCOPE,
} from '../constants/constants'
import { useToast } from '@chakra-ui/react'
import { OrderCloudError } from 'ordercloud-javascript-sdk'
import GlobalLoadingIndicator from '../components/Shared/GlobalLoadingIndicator'
import { schemaObject } from '../config/xpSchemas'
import routes from '../routes'

const basename = import.meta.env.VITE_APP_CONFIG_BASE

const router = createBrowserRouter(routes, { basename })

const AppProvider: FC = () => {
  const toast = useToast()

  useEffect(() => {
    const interceptorId = axios.interceptors.request.use((config) => {
      const requestUrl = config.url || ''
      const hasTemplateParam = requestUrl.includes('{') || requestUrl.includes('}')

      if (hasTemplateParam) {
        console.warn('Blocked OrderCloud request with unresolved template params', {
          method: config.method,
          url: config.url,
          params: config.params,
          source: 'axios.interceptors.request (AppProvider)',
        })

        return Promise.reject(
          new AxiosError(
            `Blocked request with unresolved template params: ${requestUrl}`,
            'OC_TEMPLATE_PARAM_BLOCKED',
            config
          )
        )
      }

      return config
    })

    return () => {
      axios.interceptors.request.eject(interceptorId)
    }
  }, [])

  const defaultErrorHandler = useCallback(
    (error: OrderCloudError, { logout }: IOrderCloudErrorContext) => {
      if (error.status === 401) {
        console.log('DEFAULT ERROR HANDLER', 401)
        return logout()
      }
      if (!toast.isActive(error.errorCode)) {
        toast({
          id: error.errorCode,
          title: error.status === 403 ? 'Permission denied' : error.message,
          status: 'error',
        })
      }
    },
    [toast]
  )

  return (
    <OrderCloudProvider
      baseApiUrl={BASE_API_URL}
      clientId={CLIENT_ID}
      scope={SCOPE}
      customScope={CUSTOM_SCOPE}
      allowAnonymous={ALLOW_ANONYMOUS}
      defaultErrorHandler={defaultErrorHandler}
      xpSchemas={schemaObject}
    >
      <RouterProvider router={router} />
      <GlobalLoadingIndicator />
    </OrderCloudProvider>
  )
}

export default AppProvider
