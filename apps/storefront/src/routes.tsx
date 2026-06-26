import { Navigate, RouteObject } from "react-router-dom";
import Layout from "./Layout/Layout";
import Dashboard from './components/Dashboard';
import OrderConfirmation from "./components/cart/OrderConfirmation";
import MyOrders from "./components/orders/MyOrders";
import { ShoppingCart } from "./components/cart/ShoppingCart";
import CategoryList from "./components/category/CategoryList";
import ProductDetailWrapper from "./components/product/ProductDetailWrapper";
import ProductList from "./components/product/ProductList";
import EventCommerceSetup from "./components/event-commerce-setup/EventCommerceSetup";

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
        path: "/orders",
        element: <MyOrders />,
      },
      {
        path: "/event-configuration",
        element: <Navigate to="/event-commerce-setup" replace />,
      },
      {
        path: "/event-commerce-setup",
        element: <EventCommerceSetup />,
      },

      {
        path: "/products",
        element: <ProductList />,
      },
      {
        path: "/shop/:catalogId/categories",
        element: <CategoryList />,
      },
      {
        path: "/shop/:catalogId/categories/:categoryId",
        element: <CategoryList />,
      },
      {
        path: "/shop/:catalogId/categories/:categoryId/products",
        element: <ProductList />,
      },
      {
        path: "/shop/:catalogId/products",
        element: <ProductList />,
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
