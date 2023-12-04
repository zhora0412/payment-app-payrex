import {json} from "@remix-run/node";
import type {ActionFunctionArgs} from "@remix-run/node";
import prisma from "~/db.server";
import {buildBaseUrl, buildSignature} from "~/signature.server";
import qs from "qs";
import type {QueryParams} from "~/types";

export async function action({request}: ActionFunctionArgs) {
  const refund = await request.json();
  const store = request.headers.get('Shopify-Shop-Domain');
  if (!store) {
    return json({
      error: 'Shop not found'
    }, {status: 400})
  }
  const shopData = await prisma.shop.findUnique({where: {name: store}});
  if (!shopData) {
    return json({
      error: 'Store data not found'
    }, {status: 400})
  }
  const instance_key = shopData.instance_key;
  const api_key = shopData.api_key;
  const refundData = await prisma.payment.findUnique({where: {shopify_key: refund.payment_id}});

  if (!refundData) {
    return json({
      error: 'Refund not found'
    }, {status: 400})
  }

  const baseUrl = buildBaseUrl(shopData.platform_key!)

  if (refundData.status === 'refunding') {
    return json({}, {status: 200})
  } else {
    await prisma.payment.update({
      where: {
        shopify_key: refund.payment_id
      },
      data: {
        refund_gid_id: refund.gid,
        status: 'refunding',
      }
    })

    const defaultParams = {
      amount: (parseFloat(refund.amount) * 100) | 0,
      currency: refund.currency,
    }
    let queryParams: QueryParams = Object.assign({}, defaultParams)
    const queryStr = qs.stringify(queryParams, {format: 'RFC1738'})
    queryParams.ApiSignature = buildSignature(api_key!, queryStr)
    const refundObj = qs.stringify(queryParams)
    const refundIDQuery = refundData.payrexx_id! | 0
    const createRefund = await fetch(`${baseUrl}Transaction/${refundIDQuery}/refund?instance=${instance_key}`, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: refundObj
    })

    if (!createRefund.ok) {
      console.log('here')
      const error = await createRefund.json();
      console.log(error)
      return json({error}, {status: createRefund.status});
    }
  }

  return json({}, {status: 201})
}
