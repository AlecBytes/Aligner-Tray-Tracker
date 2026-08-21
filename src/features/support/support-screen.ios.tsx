import { Button, Form, Host, HStack, ProgressView, Section, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonStyle,
  disabled,
  font,
  foregroundStyle,
  frame,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { ActionButton, ValidationMessage } from '@/components/expo-ui-components';
import { mockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import type {
  SupportProduct,
  SupportPurchaseService,
} from '@/features/support/support-purchase-service';
import { supportReducer, type SupportState } from '@/features/support/support-state';
import { useAppTheme } from '@/theme/use-app-theme';

type SupportScreenProps = {
  purchaseService?: SupportPurchaseService;
};

type ProductOptionsProps = {
  disabled: boolean;
  onPurchase: (productId: string) => void;
  processingProductId?: string;
  products: readonly SupportProduct[];
};

const INITIAL_STATE: SupportState = { status: 'loading' };
const unavailableSupportPurchaseService: SupportPurchaseService = {
  async loadProducts() {
    return [];
  },
  async purchase() {
    throw new Error('Support purchases are not configured.');
  },
};
const defaultSupportPurchaseService = __DEV__
  ? mockSupportPurchaseService
  : unavailableSupportPurchaseService;

function ProductOptions({
  disabled: purchasesDisabled,
  onPurchase,
  processingProductId,
  products,
}: ProductOptionsProps) {
  const theme = useAppTheme();

  return (
    <>
      {products.map((product) => {
        const processing = product.id === processingProductId;
        return (
          <Button
            key={product.id}
            modifiers={[
              buttonStyle('plain'),
              disabled(purchasesDisabled),
              accessibilityLabel(`${product.title}, ${product.displayPrice}`),
            ]}
            onPress={() => onPurchase(product.id)}>
            <HStack
              spacing={12}
              modifiers={[frame({ maxWidth: Infinity, minHeight: 48 }), padding({ vertical: 6 })]}>
              <Text modifiers={[font({ weight: 'semibold' })]}>{product.title}</Text>
              <Spacer />
              {processing ? <ProgressView /> : null}
              <Text modifiers={[font({ weight: 'semibold' }), foregroundStyle(theme.primary)]}>
                {processing ? 'Processing…' : product.displayPrice}
              </Text>
            </HStack>
          </Button>
        );
      })}
    </>
  );
}

function IntroSection() {
  return (
    <Section>
      <VStack alignment="leading" spacing={8}>
        <Text modifiers={[font({ textStyle: 'title2', weight: 'bold' })]}>Support is optional</Text>
        <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
          If Aligner Tracker is useful to you, you can support its continued development with a
          one-time tip.
        </Text>
      </VStack>
    </Section>
  );
}

export function SupportScreen({
  purchaseService = defaultSupportPurchaseService,
}: SupportScreenProps) {
  const theme = useAppTheme();
  const mounted = useRef(true);
  const purchaseInProgress = useRef(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [state, dispatch] = useReducer(supportReducer, INITIAL_STATE);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    dispatch({ type: 'load-started' });
    void purchaseService
      .loadProducts()
      .then((products) => {
        if (active) {
          dispatch({ products, type: 'load-succeeded' });
        }
      })
      .catch(() => {
        if (active) {
          dispatch({ type: 'load-failed' });
        }
      });
    return () => {
      active = false;
    };
  }, [loadAttempt, purchaseService]);

  const purchase = useCallback(
    async (productId: string) => {
      if (purchaseInProgress.current) {
        return;
      }
      purchaseInProgress.current = true;
      dispatch({ productId, type: 'purchase-started' });
      try {
        const result = await purchaseService.purchase(productId);
        if (mounted.current) {
          dispatch({
            type: result.status === 'cancelled' ? 'purchase-cancelled' : 'purchase-succeeded',
          });
        }
      } catch {
        if (mounted.current) {
          dispatch({ type: 'purchase-failed' });
        }
      } finally {
        purchaseInProgress.current = false;
      }
    },
    [purchaseService],
  );

  if (state.status === 'loading') {
    return <AppLoadingScreen message="Loading support options…" />;
  }

  return (
    <Host seedColor={theme.primary} style={{ flex: 1 }}>
      <Form>
        <IntroSection />

        {state.status === 'products-unavailable' ? (
          <Section title="Support options unavailable">
            <Text>Support options could not be loaded. Please try again.</Text>
            <ActionButton
              label="Try again"
              onPress={() => setLoadAttempt((attempt) => attempt + 1)}
              prominent={false}
            />
          </Section>
        ) : null}

        {state.status === 'purchase-successful' ? (
          <Section title="Thank you">
            <Text>Thank you for supporting Aligner Tracker.</Text>
            <ActionButton
              label="Support again"
              onPress={() => dispatch({ type: 'support-again' })}
              prominent={false}
            />
          </Section>
        ) : null}

        {state.status === 'purchase-cancelled' ? (
          <Section>
            <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Purchase cancelled. You were not charged.
            </Text>
          </Section>
        ) : null}

        {state.status === 'purchase-failed' ? (
          <Section>
            <ValidationMessage message="The purchase could not be completed. Please try again." />
          </Section>
        ) : null}

        {state.status === 'products-available' ||
        state.status === 'purchase-in-progress' ||
        state.status === 'purchase-cancelled' ||
        state.status === 'purchase-failed' ? (
          <Section title="One-time tips">
            <ProductOptions
              disabled={state.status === 'purchase-in-progress'}
              onPurchase={(productId) => void purchase(productId)}
              processingProductId={
                state.status === 'purchase-in-progress' ? state.productId : undefined
              }
              products={state.products}
            />
          </Section>
        ) : null}

        <Section>
          <Text modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            No features are locked behind support.
          </Text>
        </Section>
      </Form>
    </Host>
  );
}
