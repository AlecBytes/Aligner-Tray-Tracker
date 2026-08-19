import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppLoadingScreen } from '@/components/app-loading-screen';
import { AppScreen } from '@/components/app-screen';
import { AppText } from '@/components/app-text';
import { mockSupportPurchaseService } from '@/features/support/mock-support-purchase-service';
import type {
  SupportProduct,
  SupportPurchaseService,
} from '@/features/support/support-purchase-service';
import { supportReducer, type SupportState } from '@/features/support/support-state';
import { radius, spacing } from '@/theme/tokens';
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
  disabled,
  onPurchase,
  processingProductId,
  products,
}: ProductOptionsProps) {
  const theme = useAppTheme();

  return (
    <View accessibilityLabel="Support options" style={styles.products}>
      {products.map((product) => {
        const processing = product.id === processingProductId;

        return (
          <Pressable
            accessibilityLabel={`${product.title}, ${product.displayPrice}`}
            accessibilityRole="button"
            disabled={disabled}
            key={product.id}
            onPress={() => onPurchase(product.id)}
            style={({ pressed }) => [
              styles.product,
              {
                backgroundColor: pressed ? theme.border : theme.surface,
                borderColor: theme.border,
                opacity: disabled && !processing ? 0.55 : 1,
              },
            ]}>
            <AppText style={styles.productTitle}>{product.title}</AppText>
            <View style={styles.productAction}>
              {processing ? <ActivityIndicator color={theme.primary} size="small" /> : null}
              <AppText style={[styles.productPrice, { color: theme.primary }]}>
                {processing ? 'Processing…' : product.displayPrice}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
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

  const intro = (
    <View style={styles.intro}>
      <AppText variant="heading">Support is optional</AppText>
      <AppText muted>
        If Aligner Tracker is useful to you, you can support its continued development with a
        one-time tip.
      </AppText>
    </View>
  );

  if (state.status === 'products-unavailable') {
    return (
      <AppScreen scrollable>
        {intro}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="heading">Support options unavailable</AppText>
          <AppText muted>Support options could not be loaded. Please try again.</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => setLoadAttempt((attempt) => attempt + 1)}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: pressed ? theme.border : theme.background,
                borderColor: theme.border,
              },
            ]}>
            <AppText style={styles.buttonLabel}>Try again</AppText>
          </Pressable>
        </View>
        <AppText muted style={styles.noFeatures} variant="caption">
          No features are locked behind support.
        </AppText>
      </AppScreen>
    );
  }

  if (state.status === 'purchase-successful') {
    return (
      <AppScreen scrollable>
        {intro}
        <View
          accessibilityLiveRegion="polite"
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <AppText variant="heading">Thank you</AppText>
          <AppText muted>Thank you for supporting Aligner Tracker.</AppText>
          <Pressable
            accessibilityRole="button"
            onPress={() => dispatch({ type: 'support-again' })}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                backgroundColor: pressed ? theme.border : theme.background,
                borderColor: theme.border,
              },
            ]}>
            <AppText style={styles.buttonLabel}>Support again</AppText>
          </Pressable>
        </View>
        <AppText muted style={styles.noFeatures} variant="caption">
          No features are locked behind support.
        </AppText>
      </AppScreen>
    );
  }

  const purchasePending = state.status === 'purchase-in-progress';

  return (
    <AppScreen scrollable>
      {intro}

      {state.status === 'purchase-cancelled' ? (
        <AppText accessibilityLiveRegion="polite" muted variant="caption">
          Purchase cancelled. You were not charged.
        </AppText>
      ) : null}

      {state.status === 'purchase-failed' ? (
        <AppText accessibilityLiveRegion="polite" style={{ color: theme.error }} variant="caption">
          The purchase could not be completed. Please try again.
        </AppText>
      ) : null}

      <ProductOptions
        disabled={purchasePending}
        onPurchase={(productId) => void purchase(productId)}
        processingProductId={purchasePending ? state.productId : undefined}
        products={state.products}
      />

      <AppText muted style={styles.noFeatures} variant="caption">
        No features are locked behind support.
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  buttonLabel: {
    fontWeight: '700',
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
    padding: spacing.lg,
  },
  intro: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  noFeatures: {
    textAlign: 'center',
  },
  product: {
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  productAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  productPrice: {
    fontWeight: '700',
  },
  products: {
    gap: spacing.md,
  },
  productTitle: {
    flex: 1,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
});
