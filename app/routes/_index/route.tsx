import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { login } from "../../shopify.server";
import indexStyles from "./style.css";

export const links = () => [{ rel: "stylesheet", href: indexStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return json({ showForm: Boolean(login) });
};

export default function App() {
  const sectionStyles = {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    justifyContent: 'center',
    flexDirection: 'column',
    alignItems: 'center',
  }

  return (
    <>
      <section
        // @ts-ignore
        style={sectionStyles}>
        <h3>403 - Forbidden</h3>
        <p>Access Denied. You are trying to access data without proper authorization.
          Please ensure you are logged in from Shopify store account.
        </p>
      </section>
    </>
  );
}
