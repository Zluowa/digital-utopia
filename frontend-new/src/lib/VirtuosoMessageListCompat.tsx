import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

export type ScrollAlignment = 'start' | 'center' | 'end';

export interface ItemLocation {
  index: number | 'LAST';
  align?: ScrollAlignment;
}

export type ScrollModifier =
  | {
      type: 'item-location';
      location: ItemLocation;
      purgeItemSizes?: boolean;
    }
  | {
      type: 'auto-scroll-to-bottom';
      autoScroll?: ScrollBehavior | 'smooth' | 'auto';
    }
  | {
      type: string;
      [key: string]: unknown;
    };

export interface DataWithScrollModifier<T> {
  data: T[];
  scrollModifier?: ScrollModifier;
}

export interface VirtuosoMessageListMethods<T = unknown, C = unknown> {
  scrollToItem: (params: {
    index: number | 'LAST';
    align?: ScrollAlignment;
    behavior?: ScrollBehavior;
  }) => void;
  data: {
    getCurrentlyRendered: () => T[];
  };
  _context?: C;
}

export interface VirtuosoMessageListProps<T, C = unknown> {
  className?: string;
  style?: React.CSSProperties;
  data: DataWithScrollModifier<T> | null;
  context?: C;
  initialLocation?: ItemLocation;
  computeItemKey?: (params: {
    data: T;
    index: number;
    context: C | undefined;
  }) => React.Key;
  ItemContent?: (params: {
    data: T;
    index: number;
    context: C | undefined;
  }) => React.ReactNode;
  Header?: ((params: { context: C | undefined }) => React.ReactNode) | null;
  Footer?: ((params: { context: C | undefined }) => React.ReactNode) | null;
  EmptyPlaceholder?: ((params: { context: C | undefined }) => React.ReactNode) | null;
}

function resolveIndex(index: number | 'LAST', length: number): number {
  if (length <= 0) return 0;
  return index === 'LAST' ? length - 1 : Math.max(0, Math.min(index, length - 1));
}

function scrollTo(
  handle: VirtuosoHandle | null,
  index: number | 'LAST',
  length: number,
  align: ScrollAlignment = 'end',
  behavior: ScrollBehavior = 'auto'
) {
  if (!handle || length <= 0) return;
  handle.scrollToIndex({
    index: resolveIndex(index, length),
    align,
    behavior,
  });
}

export const VirtuosoMessageList = forwardRef(function VirtuosoMessageListInner<
  T,
  C = unknown,
>(
  {
    className,
    style,
    data,
    context,
    initialLocation,
    computeItemKey,
    ItemContent,
    Header,
    Footer,
    EmptyPlaceholder,
  }: VirtuosoMessageListProps<T, C>,
  ref: React.ForwardedRef<VirtuosoMessageListMethods<T, C>>
) {
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const visibleRangeRef = useRef<{ start: number; end: number }>({
    start: 0,
    end: -1,
  });
  const initialLocationAppliedRef = useRef(false);
  const items = useMemo(() => data?.data ?? [], [data]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToItem: ({ index, align = 'end', behavior = 'auto' }) => {
        scrollTo(virtuosoRef.current, index, items.length, align, behavior);
      },
      data: {
        getCurrentlyRendered: () => {
          const { start, end } = visibleRangeRef.current;
          if (end < start || start < 0) return [];
          return items.slice(start, end + 1);
        },
      },
      _context: context,
    }),
    [items, context]
  );

  useEffect(() => {
    if (initialLocationAppliedRef.current) return;
    if (!initialLocation || items.length === 0) return;
    initialLocationAppliedRef.current = true;
    scrollTo(
      virtuosoRef.current,
      initialLocation.index,
      items.length,
      initialLocation.align ?? 'end'
    );
  }, [initialLocation, items.length]);

  useEffect(() => {
    const modifier = data?.scrollModifier;
    if (!modifier || items.length === 0) return;

    if (modifier.type === 'item-location') {
      const location = (modifier as { location?: ItemLocation }).location;
      if (!location) return;
      scrollTo(
        virtuosoRef.current,
        location.index,
        items.length,
        location.align ?? 'end'
      );
      return;
    }

    if (modifier.type === 'auto-scroll-to-bottom') {
      const behavior =
        (modifier as { autoScroll?: ScrollBehavior | 'smooth' | 'auto' })
          .autoScroll ?? 'smooth';
      scrollTo(virtuosoRef.current, 'LAST', items.length, 'end', behavior);
    }
  }, [data, items.length]);

  const components = useMemo(
    () => ({
      Header: Header
        ? (() => <>{Header({ context })}</>)
        : undefined,
      Footer: Footer
        ? (() => <>{Footer({ context })}</>)
        : undefined,
      EmptyPlaceholder: EmptyPlaceholder
        ? (() => <>{EmptyPlaceholder({ context })}</>)
        : undefined,
    }),
    [Header, Footer, EmptyPlaceholder, context]
  );

  return (
    <Virtuoso<T>
      ref={virtuosoRef}
      className={className}
      style={style}
      data={items}
      computeItemKey={
        computeItemKey
          ? (index, item) => computeItemKey({ data: item, index, context })
          : undefined
      }
      rangeChanged={(range) => {
        visibleRangeRef.current = {
          start: range.startIndex,
          end: range.endIndex,
        };
      }}
      itemContent={(index, item) =>
        ItemContent ? (
          <>{ItemContent({ data: item, index, context })}</>
        ) : null
      }
      components={components}
    />
  );
}) as <T, C = unknown>(
  props: VirtuosoMessageListProps<T, C> & {
    ref?: React.Ref<VirtuosoMessageListMethods<T, C>>;
  }
) => React.ReactElement;

interface VirtuosoMessageListLicenseProps {
  licenseKey?: string;
  children: React.ReactNode;
}

export function VirtuosoMessageListLicense({
  children,
}: VirtuosoMessageListLicenseProps) {
  return <>{children}</>;
}
