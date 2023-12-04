import prisma from "~/db.server";
import {json} from "@remix-run/node";
import {LATEST_API_VERSION} from "@shopify/shopify-app-remix/server";
import type {ActionFunctionArgs} from "@remix-run/node";

export async function action({request}: ActionFunctionArgs) {
  const transactionObj = await request.json();

  if (transactionObj.transaction.status === 'confirmed' || transactionObj.transaction.status === 'waiting') {
    try {
      await prisma.payment.update({
        where: {
          reference_id: transactionObj.transaction.invoice.paymentRequestId,
        },
        data: {
          payrexx_id: transactionObj.transaction.id,
          payrexx_uuid: transactionObj.transaction.uuid,
          amount: transactionObj.transaction.amount,
          currency: transactionObj.transaction.invoice.currency,
          psp: transactionObj.transaction.psp,
          status: transactionObj.transaction.status,
          refund_status: transactionObj.transaction.refundable,
        }
      })
    } catch (error) {
      console.log(error, 'error')
    }
  }

  if (transactionObj.transaction.status === 'partially-refunded' || transactionObj.transaction.status === 'refunded') {
    try {
      await prisma.payment.update({
        where: {
          reference_id: transactionObj.transaction.invoice.paymentRequestId,
        },
        data: {
          status: transactionObj.transaction.status,
        }
      })
    } catch (error) {
      console.log(error, 'error')
    }

    const payment = await prisma.payment.findUnique({
      where: {
        reference_id: transactionObj.transaction.invoice.paymentRequestId,
      }
    });

    if (!payment || !payment.shop) {
      return json({ error: 'Payment not found' }, { status: 400 });
    }

    const shop = await prisma.shop.findUnique({
      where: {
        name: payment.shop,
      }
    });

    if (!shop || !shop.access_token) {
      return json({ error: 'Shop not authorized' }, { status: 404 });
    }

    const headers = new Headers();
    headers.set('X-Shopify-Access-Token', shop.access_token);
    headers.set('accept', 'application/json');
    headers.set('Content-Type', 'application/json');
    await fetch(`https://${shop.name}/payments_apps/api/${LATEST_API_VERSION}/graphql.json`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: `
            mutation RefundSessionResolve($id: ID!) {
              refundSessionResolve(id: $id) {
                refundSession {
                  id
                  state {
                    ... on RefundSessionStateResolved {
                      code
                    }
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
          variables: {
            id: payment.refund_gid_id,
          },
        }),
      },
    );
  }


  return json({}, {status: 200})
}
