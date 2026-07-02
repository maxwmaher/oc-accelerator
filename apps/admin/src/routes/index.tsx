import { RouteObject } from 'react-router-dom'
import { resources } from './resources'
import { omit } from 'lodash'
import { NotFoundPage } from '../404'
import Dashboard from '../components/Dashboard/Dashboard'
import Layout from '../components/Layout/Layout'
import RaiEventSetupLanding from '../components/RaiEventSetup/RaiEventSetupLanding'
import { RaiBuyerWizard, RaiProductWizard } from '../components/RaiEventSetup/RaiWizard'

const resourceRoutes: RouteObject[] = resources.map((r) => omit(r, 'label') as RouteObject)

const routes: RouteObject[] = [
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <Dashboard />,
      },
      {
        path: '/rai-event-setup',
        element: <RaiEventSetupLanding />,
      },
      {
        path: '/rai-event-setup/products/new',
        element: <RaiProductWizard />,
      },
      {
        path: '/rai-event-setup/buyers/new',
        element: <RaiBuyerWizard />,
      },
      ...resourceRoutes,
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]

export default routes
