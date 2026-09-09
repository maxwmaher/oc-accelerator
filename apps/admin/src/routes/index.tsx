import { RouteObject } from 'react-router-dom'
import { resources } from './resources'
import { omit } from 'lodash'
import { NotFoundPage } from '../404'
import Dashboard from '../components/Dashboard/Dashboard'
import Layout from '../components/Layout/Layout'
import PelckmansWorkspace from '../components/Pelckmans/PelckmansWorkspace'

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
      { path: '/pelckmans', element: <PelckmansWorkspace /> },
      { path: '/pelckmans/new', element: <PelckmansWorkspace mode="new" /> },
      { path: '/pelckmans/offers/:offerId', element: <PelckmansWorkspace mode="detail" /> },
      { path: '/pelckmans/offers/:offerId/review', element: <PelckmansWorkspace mode="review" /> },
      ...resourceRoutes,
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]

export default routes
