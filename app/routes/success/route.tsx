import {json} from "@remix-run/node";
import type {LoaderFunctionArgs} from "@remix-run/node";
import {LATEST_API_VERSION} from "@shopify/shopify-app-remix/server";
import {authenticate} from "~/shopify.server";

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const gid = url.searchParams.get('gid');
  const store = url.searchParams.get('store');
  const headers = new Headers();
  headers.set('X-Shopify-Access-Token', session.accessToken ? session.accessToken : '');
  headers.set('accept', 'application/json');
  headers.set('Content-Type', 'application/json');

  const paymentResolve = await fetch(`https://${store}/payments_apps/api/${LATEST_API_VERSION}/graphql.json`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: `
            mutation PaymentSessionResolve(
              $id: ID!,
            ) {
              paymentSessionResolve(
                id: $id,
              ) {
                paymentSession {
                  id
                  state {
                    ... on PaymentSessionStateResolved {
                      code
                    }
                  }
                  nextAction {
                    action
                    context {
                      ... on PaymentSessionActionsRedirect {
                        redirectUrl
                      }
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `,
      variables: {
        id: gid,
      },
    }),
  });

  const resolveData = await paymentResolve.json();
  if (resolveData.data.paymentSessionResolve.paymentSession.state.code === 'RESOLVED' ||
    resolveData.data.paymentSessionResolve.paymentSession.nextAction.action === 'resolved'
  ) {
    return json({}, {
      status: 302,
      headers: {
        'Location': resolveData.data.paymentSessionResolve.paymentSession.nextAction.context.redirectUrl,
      }
    });
  }

  return json({error: 'Payment not resolved'}, {status: 500});
}
