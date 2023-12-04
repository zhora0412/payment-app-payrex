import type {ActionFunctionArgs, LoaderFunctionArgs} from "@remix-run/node";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  Box,
  TextField,
  Select,
  InlineGrid,
  BlockStack,
  PageActions,
  InlineStack, Toast, Frame,
} from "@shopify/polaris";
import {authenticate} from "~/shopify.server";
import {ExternalMinor} from '@shopify/polaris-icons';
import {useCallback, useEffect, useState} from "react";
import {useActionData, useLoaderData, useSubmit} from "@remix-run/react";
import {json} from "@remix-run/node";
import {buildBaseUrl, buildUrl} from "~/signature.server";
import type {ActionData, Design, ShopData, Localization, Language} from "~/types";
import {LATEST_API_VERSION} from "@shopify/shopify-app-remix/server";
import {localizationData} from "~/localization";

export const loader = async ({request}: LoaderFunctionArgs) => {
  const {session} = await authenticate.admin(request);

  const shopData = await prisma.shop.findUnique({
    where: {
      name: session.shop,
    }
  });

  if (!shopData) {
    const shopData = await prisma.shop.create({
      data: {
        name: session.shop,
        access_token: session.accessToken,
      },
    })
    return json({shopData}, {status: 201})
  }

  if (shopData.api_key) {
    const baseUrl = buildBaseUrl('auth')
    const designsURL = buildUrl(baseUrl, `Design/`, shopData.instance_key ? shopData.instance_key : '', shopData.api_key);

    const getDesigns = await fetch(`${designsURL}`, {
      method: 'GET',
      headers: {accept: 'application/json'}
    })

    const designs = await getDesigns.json();
    const loader_designsData = designs.data;
    const loader_design_current = designs.data.find((obj: Design) => obj.name.includes(shopData.design_name ? shopData.design_name : ''));

    return json({shopData, loader_designsData, loader_design_current}, {status: 200})
  }

  return json({shopData}, {status: 200});
};


export async function action({request}: ActionFunctionArgs) {
  try {
    const {session} = await authenticate.admin(request);
    const {instance_key, api_key, new_current_design, platform_key, language}: any = {
      ...Object.fromEntries(await request.formData()),
    }
    const baseUrl = buildBaseUrl('auth')
    const validityURL = buildUrl(baseUrl, 'SignatureCheck', instance_key, api_key);
    const designsURL = buildUrl(baseUrl, 'Design/', instance_key, api_key);
    const checkValidity = await fetch(`${validityURL}`, {
      method: 'GET',
      headers: {accept: 'application/json'}
    })

    if (!checkValidity.ok) {
      return json({message: "Not Authorized"}, {status: 404})
    } else if (checkValidity.ok) {
      await prisma.shop.update({
        where: {
          name: session.shop
        },
        data: {
          instance_key: instance_key,
          api_key: api_key,
          language: language,
          platform_key: platform_key,
        }
      })
    }

    const shopData = await prisma.shop.findUnique({
      where: {
        name: session.shop,
      }
    });

    if (!shopData) {
      return json({ error: 'shopData is missing' }, { status: 400 });
    }

    let authorization_status_trigger = false;

    if (!shopData.authorization_status) {
      const apiUrl = `https://${session.shop}/payments_apps/api/${LATEST_API_VERSION}/graphql.json`;
      const graphQlContent = `
        mutation paymentsAppConfigure($ready: Boolean!, $externalHandle: String!) {
          paymentsAppConfigure(ready: $ready, externalHandle: $externalHandle) {
            paymentsAppConfiguration {
              externalHandle
              ready
            }
            userErrors {
              field
              message
            }
          }
        }
        `;
      const variables = {
        externalHandle: session.shop,
        ready: true,
      }
      const headers = new Headers();
      headers.set("Content-Type", "application/json");
      headers.set("X-Shopify-Access-Token", session.accessToken ? session.accessToken : '');
      const requestOptions = {
        method: "POST",
        headers,
        body: JSON.stringify({
          query: graphQlContent,
          variables: variables,
        }),
      };
      fetch(apiUrl, requestOptions)
        .then((response) => response.json())
        .then((data) => {
          return data.data.paymentsAppConfigure
        })
        .catch(error => console.log(error));

      await prisma.shop.update({
        where: {
          name: session.shop
        },
        data: {
          authorization_status: true
        }
      })
      authorization_status_trigger = true;
    }

    const getDesigns = await fetch(`${designsURL}`, {
      method: 'GET',
      headers: {accept: 'application/json'}
    })

    if (!getDesigns.ok) {
      return json({instance_key, api_key}, {status: 200});
    }

    const designs = await getDesigns.json();
    const designsData = designs.data;

    if (!new_current_design) {
      let current_design: Design = designs.data.find((item: Design) => item.default);
      if (current_design) {
        await prisma.shop.update({
          where: {
            name: session.shop
          },
          data: {
            design_key: current_design.uuid,
            design_name: current_design.name,
          }
        })
      }
      return json({
        instance_key,
        api_key,
        designsData,
        current_design,
        activeStatus: authorization_status_trigger
      }, {status: 200});
    } else if (new_current_design) {
      const new_current_design_item = designs.data.find(function (obj: Design) {
        return obj.name.includes(new_current_design);
      });

      const shopData = await prisma.shop.findFirst({
        where: {
          name: session.shop
        }
      })

      if (!shopData) {
        return json({ error: 'shopData is missing' }, { status: 400 });
      }

      const design_key = shopData.design_key
      if (!design_key) {
        return json({ error: 'design_key is missing' }, { status: 400 });
      }
      let current_design_data = designs.data.find(function (obj :Design) {
        return obj.uuid.includes(design_key);
      });

      let current_design
      if (new_current_design_item.name !== current_design_data.name) {
        await prisma.shop.update({
          where: {
            name: session.shop
          },
          data: {
            design_key: new_current_design_item.uuid,
            design_name: new_current_design_item.name,
          }
        })
        current_design = new_current_design_item;

      }
      return json({
        instance_key,
        api_key,
        designsData,
        current_design,
        activeStatus: authorization_status_trigger
      }, {status: 200});
    }
    let current_design = new_current_design  //fix bug with current design
    return json({
      instance_key,
      api_key,
      designsData,
      current_design,
      activeStatus: authorization_status_trigger
    }, {status: 200});
  } catch (err) {
    console.log(err);
    return json(null, {status: 500})
  }
}

const localizationObj : Localization = localizationData

export default function Index() {
  const {shopData, loader_designsData, loader_design_current} = useLoaderData<ShopData>();
  const actionData: ActionData | undefined = useActionData();
  const [validateConfiguration, setValidateConfiguration] = useState(!!shopData.api_key);
  const [apiKey, setApiKey] = useState(shopData.api_key || '');
  const [instanceName, setInstanceName] = useState(shopData.instance_key || '');
  const [platformKey, setPlatformKey] = useState(shopData.platform_key || '');
  const [currentDesign, setCurrentDesign] = useState(loader_design_current ? loader_design_current.name : '');
  const [designs, setDesigns] = useState(loader_designsData || null);
  const [activeToast, setActiveToast] = useState(false);
  const [activeSuccessToast, setActiveSuccessToast] = useState(false);
  const [localization, setLocalization] = useState<Language>(shopData.language || 'EN');
  const [translate, setTranslate] = useState<any>(localizationObj[localization]);

  const submit = useSubmit();


  let supportLink = 'https://developers.payrexx.com/reference/rest-api';

  function translateText(key: string, params = {} as any) {
    let result = translate[key];
    Object.keys(params).forEach((key) => {   // if we have one more calculation uniq value
      result = result.replace(`{{${key}}}`, params[key]);
    });
    return result;
  }

  const handleDesignChange = ((designName: string) => {
    setCurrentDesign(designName);
  });

  const toggleActive = useCallback(() => setActiveToast((activeToast) => !activeToast), [])
  const toggleSuccessActive = useCallback(() => setActiveSuccessToast((activeSuccessToast) => !activeSuccessToast), [])
  useEffect(() => {
    if (actionData) {
      if (actionData.hasOwnProperty('message')) {
        setActiveToast(true)
      } else {
        if (!validateConfiguration) setValidateConfiguration(true);
        setActiveSuccessToast(true)
      }

      if (Array.isArray(actionData.designsData) && actionData.designsData.length) {
        setDesigns(actionData.designsData);
      }
      setCurrentDesign(actionData.current_design ? actionData.current_design.name : '')

      if (actionData.activeStatus) {
        window.location.href = `https://${shopData.name}/services/payments_partners/gateways/${'719e4fe2e4f17facb40b68c496f9b697'}/settings`
      }
    }
  }, [actionData, shopData, toggleActive, validateConfiguration])


  const handleChange = useCallback((newValue: string, stateKey: string) => {
    if (stateKey === 'apiKey') {
      setApiKey(newValue);
    } else if (stateKey === 'instanceName') {
      setInstanceName(newValue);
    } else if (stateKey === 'platformKey') {
      setPlatformKey(newValue);
    }
  }, []);

  const submitDataFields = (apiKey: string, instanceKey: string, localization: string, currentDesign?: string) => {
    const data = {
      instance_key: instanceKey,
      api_key: apiKey,
      platform_key: platformKey,
      language: localization,
      new_current_design: currentDesign || ''
    }

    submit(data, {method: "post"});
  }

  useEffect(() => {
    setTranslate(localizationObj[localization])
  }, [localization])

  return (
    <Frame>
      <Page narrowWidth>
        <Layout>
          <Layout.Section>
            <InlineStack align={'center'}>
              <Text as={'h1'} variant={'heading2xl'}>{translateText('PLUGIN_TITLE')}</Text>
            </InlineStack>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap={"500"}>
                <div>
                  <InlineGrid columns={['oneHalf', 'oneHalf']}>
                    <Box>
                      <Text variant="headingLg" fontWeight={'medium'} as="h3">
                        {translateText('SECTION_TITLE_CREDENTIALS')}
                      </Text>
                      <Text variant="headingSm" as="h6" fontWeight={'regular'} tone={'subdued'}>
                        {translateText('REQUIRED')}
                      </Text>
                    </Box>
                    <Box>
                      <InlineStack blockAlign={'center'} align={'end'}>
                        <Box><span style={{display: 'flex', marginRight: '20px'}}
                                   dangerouslySetInnerHTML={{__html: translate.flag}}></span></Box>
                        <Box width={'50px'}>
                          <InlineGrid>
                            <Select
                              label=""
                              options={Object.keys(localizationObj).map((key) => ({value: key, label: key}))}
                              onChange={(value : Language) => {
                                setLocalization(value)
                              }}
                              value={localization}
                            />
                          </InlineGrid>
                        </Box>
                      </InlineStack>
                    </Box>
                  </InlineGrid>
                </div>
                <div className={"input-item"}>
                  <InlineGrid columns={['oneThird', 'twoThirds']}>
                    <Box>
                      <Text variant="headingMd" fontWeight={'regular'} as="h3">
                        {translateText('PLATFORM_KEY')}
                      </Text>
                    </Box>
                    <Box>
                      <TextField
                        label=""
                        value={platformKey}
                        onChange={(value) => handleChange(value, 'platformKey')}
                        autoComplete="off"
                      />
                    </Box>
                  </InlineGrid>
                </div>
                <div className={"input-item"}>
                  <InlineGrid columns={['oneThird', 'twoThirds']}>
                    <Box>
                      <Text variant="headingMd" fontWeight={'regular'} as="h3">
                        {translateText('INSTANCE_NAME_KEY')}
                      </Text>
                    </Box>
                    <Box>
                      <TextField
                        label=""
                        value={instanceName}
                        onChange={(value) => handleChange(value, 'instanceName')}
                        autoComplete="off"
                      />
                      <Text variant={"bodySm"} as={"p"}>
                        {translateText('INSTANCE_DESCRIPTION')}
                      </Text>
                    </Box>
                  </InlineGrid>
                </div>
                <div className={"input-item"}>
                  <InlineGrid columns={['oneThird', 'twoThirds']}>
                    <Box>
                      <Text variant="headingMd" fontWeight={'regular'} as="h3">
                        {translateText('API_KEY')}
                      </Text>
                    </Box>
                    <Box>
                      <TextField
                        label=""
                        value={apiKey}
                        onChange={(value) => handleChange(value, 'apiKey')}
                        autoComplete="off"
                      />
                      <Text variant={"bodySm"} as={"p"}>
                        {translateText('API_DESCRIPTION')}
                      </Text>
                    </Box>
                  </InlineGrid>
                </div>
                <Box>
                  <Text variant="bodyMd" as="p">
                    {translateText('CREDENTIALS_DESCRIPTION')}
                  </Text>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
          {validateConfiguration && (<div>
            <Layout.Section>
              <Card>
                <BlockStack gap={"500"}>
                  <div>
                    <Text variant="headingLg" fontWeight={'medium'} as="h3">
                      {translateText('SECTION_TITLE_DESIGN')}
                    </Text>
                    <Text variant="headingSm" as="h6" fontWeight={'regular'} tone={'subdued'}>
                      {translateText('OPTIONAL')}
                    </Text>
                  </div>
                  <div>
                    <Text variant="bodyMd" as="p">
                      {translateText('DESIGN_DESCRIPTION')}
                    </Text>
                  </div>
                  <div className={"input-item"}>
                    <InlineGrid columns={['oneThird', 'twoThirds']}>
                      <Box>
                        <Text variant="headingMd" fontWeight={'regular'} as="p">
                          {translateText('DESIGN_KEY')}
                        </Text>
                      </Box>
                      <Box>
                        <Select
                          label=""
                          options={designs && Array.isArray(designs) ? designs.map((design: any) => design.name) : undefined}
                          onChange={handleDesignChange}
                          value={currentDesign || ''}
                          disabled={!designs}
                        />
                      </Box>
                    </InlineGrid>
                  </div>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section>
              <Card>
                <BlockStack gap={"500"}>
                  <Text variant="headingLg" fontWeight={'medium'} as="h3">
                    {translateText('PAYMENT_METHODS')}
                  </Text>
                  <Text variant="bodyMd" as="p">
                    {translateText('PAYMENT_METHODS_INFO')}
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          </div>)}
          <Layout.Section>
            <Card>
              <BlockStack gap={"500"}>
                <Text variant="headingLg" fontWeight={'medium'} as="h3">
                  {translateText('TITLE_HELP')}
                </Text>
                <Text variant="bodyMd" as="p">
                  {translateText('DESCRIPTION_HELP')}
                </Text>
                <InlineStack align={'end'}>
                  <Button icon={ExternalMinor} size={'large'} target={'_blank'} url={supportLink}
                          external>{translateText('SUPPORT_SYSTEM')}</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <PageActions
              primaryAction={{
                content: translateText('SAVE'),
                onAction() {
                  submitDataFields(apiKey, instanceName, localization, currentDesign);
                }
              }}
              secondaryActions={[
                {
                  content: translateText('CANCEL'),
                  destructive: true,
                },
              ]}
            />
          </Layout.Section>
        </Layout>
        {activeToast && (<Toast content="Invalid instance-name or API key." error onDismiss={toggleActive}/>)}
        {activeSuccessToast && (<Toast content="Success" onDismiss={toggleSuccessActive}/>)}
      </Page>
    </Frame>
  );
}
