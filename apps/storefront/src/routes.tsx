import { RouteObject } from "react-router-dom";
import Layout from "./Layout/Layout";
import Dashboard from './components/Dashboard';
import OrderConfirmation from "./components/cart/OrderConfirmation";
import { ShoppingCart } from "./components/cart/ShoppingCart";
import CategoryList from "./components/category/CategoryList";
import ProductDetailWrapper from "./components/product/ProductDetailWrapper";
import ProductList from "./components/product/ProductList";

import CountryCatalogGuard from "./components/CountryCatalogGuard";

const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        path: "/",
        element: <Dashboard />,
      },
      {
        path: "/cart",
        element: <ShoppingCart />,
      },

      {
        path: "/products",
        element: <CountryCatalogGuard><ProductList /></CountryCatalogGuard>,
      },
      {
        path: "/shop/:catalogId/categories",
        element: <CountryCatalogGuard><CategoryList /></CountryCatalogGuard>,
      },
      {
        path: "/shop/:catalogId/categories/:categoryId",
        element: <CountryCatalogGuard><CategoryList /></CountryCatalogGuard>,
      },
      {
        path: "/shop/:catalogId/categories/:categoryId/products",
        element: <CountryCatalogGuard><ProductList /></CountryCatalogGuard>,
      },
      {
        path: "/shop/:catalogId/products",
        element: <CountryCatalogGuard><ProductList /></CountryCatalogGuard>,
      },
      {
        path: "/products/:productId",
        element: <ProductDetailWrapper />,
      },
    ],
  },
  {
    path: "/order-confirmation",
    element: <OrderConfirmation />,
  },
];

export default routes;
