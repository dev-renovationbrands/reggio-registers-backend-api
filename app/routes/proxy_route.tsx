import type { LoaderFunctionArgs } from "react-router";
import { authenticate, sessionStorage, unauthenticated , } from "../shopify.server";
import { useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {

  console.log("🔐 >> action..");

  const url = new URL(request.url);
  const session = await sessionStorage.loadSession(
    "offline_" + url.searchParams.get("shop"),
  );

  console.log("🔐 action session:", session);

  // Use the authentication API from the React Router template
  const { admin } = await authenticate.public.appProxy(request);
  
  // Read URL parameters added by Shopify when proxying
  //const url = new URL(request.url);
  // const shop = url.searchParams.get("shop");
  // if (!shop) {
  //   return Response.json({ error: "Shop is required." }, { status: 400 });
  // }
  // const { admin: unauthenticatedAdmin } = await unauthenticated.admin(shop!);
  // console.log(">> unauthenticatedAdmin:", unauthenticatedAdmin != null);

  return {
    admin,
    session,
    shop: url.searchParams.get("shop"),
    loggedInCustomerId: url.searchParams.get("logged_in_customer_id"),
  };
};

export default function MyAppProxy() {
  const { admin, session, shop, loggedInCustomerId } = useLoaderData();
  console.log(">> session:", session != null);
  console.log(">> admin:", admin != null);



  return <div>{`Hello world from ${loggedInCustomerId || "not-logged-in"} on ${shop}`}</div>;
}