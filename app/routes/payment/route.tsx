import {json} from "@remix-run/node";
import type {ActionFunctionArgs} from "@remix-run/node";
import prisma from "~/db.server";
import {buildBaseUrl, buildSignature} from "~/signature.server";
import type {QueryParams} from "~/types";
import qs from 'qs';

export async function action({request}:ActionFunctionArgs) {
  const payment = await request.json();
  const store = request.headers.get('Shopify-Shop-Domain');

  if (!store) {
    return json({ error: 'Store not found' }, { status: 404 });
  }

  const shopData = await prisma.shop.findUnique({where: {name: store}});

  if (!shopData) {
    return json({ error: 'Lost Shop data' }, { status: 404 });
  }

  const instance_key = shopData.instance_key;
  const api_key = shopData.api_key;

  if (!api_key) {
    return json({ error: 'Api_key not found' }, { status: 404 });
  }

  const testMode = payment.test

  if (!shopData.platform_key) {
    return json({ error: 'Platform_key not found' }, { status: 404 });
  }

  const baseUrl = buildBaseUrl(shopData.platform_key, testMode)
  const defaultParams = {
    lookAndFeelProfile: shopData.design_key,
    currency: payment.currency,
    amount: (parseFloat(payment.amount) * 100) | 0,
    cancelRedirectUrl: payment.payment_method.data.cancel_url,
    successRedirectUrl: `${process.env.SHOPIFY_APP_URL}/success?gid=${payment.gid}&id=${payment.id}&store=${store}`,
    failedRedirectUrl: `${process.env.SHOPIFY_APP_URL}/failure`
  }
  let queryParams: QueryParams = Object.assign({}, defaultParams)
  const queryStr = qs.stringify(queryParams, {format: 'RFC1738'})
  queryParams.ApiSignature = buildSignature(api_key, queryStr)
  const queryStrSigned = qs.stringify(queryParams)
  const createGateway = await fetch(`${baseUrl}Gateway/?instance=${instance_key}`, {
    method: 'POST',
    headers: {accept: 'application/json'},
    body: queryStrSigned
  });

  if (!createGateway.ok) {
    const error = await createGateway.json();
    return json({error}, {status: createGateway.status});
  }

  const objGateway = await createGateway.json();

  await prisma.payment.create({
    data: {
      reference_id: objGateway.data[0].id,
      shopify_key: payment.id,
      currency: payment.currency,
      shop: store,
      status: objGateway.data[0].status
    }
  })

  const linkUrl = objGateway.data[0].link;

  return json({redirect_url: linkUrl}, {status: 200});

}
