declare module 'react' {
  export type Key = string | number;
  export type ReactNode = any;
  export type SetStateAction<S> = S | ((previousState: S) => S);
  export type Dispatch<A> = (value: A) => void;
  export type MutableRefObject<T> = {
    current: T;
  };
  export type DependencyList = readonly unknown[];
  export type MouseEvent<T = Element> = Event & {
    currentTarget: T;
    target: EventTarget & T;
  };
  export type FormEvent<T = Element> = Event & {
    currentTarget: T;
    target: EventTarget & T;
  };
  export interface CSSProperties {
    [key: string]: string | number | undefined;
  }
  export interface HTMLAttributes<T> {
    className?: string;
    style?: CSSProperties;
    onClick?: (event: MouseEvent<T>) => void;
    onMouseEnter?: (event: MouseEvent<T>) => void;
    onMouseLeave?: (event: MouseEvent<T>) => void;
  }
  export interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
    disabled?: boolean;
    type?: 'button' | 'submit' | 'reset';
  }
  export interface ImgHTMLAttributes<T> extends HTMLAttributes<T> {
    alt?: string;
    src?: string;
    width?: number | string;
    height?: number | string;
    loading?: 'lazy' | 'eager';
  }
  export interface AnchorHTMLAttributes<T> extends HTMLAttributes<T> {
    href?: string;
    rel?: string;
    target?: string;
  }
  export interface DetailedHTMLProps<E, T> extends E {}
  export interface FunctionComponent<P = {}> {
    (props: P): any;
  }
  export type FC<P = {}> = FunctionComponent<P>;
  export type PropsWithChildren<P = {}> = P & {
    children?: ReactNode;
  };
  export function useState<S>(initialState: S | (() => S)): [S, Dispatch<SetStateAction<S>>];
  export function useEffect(
    effect: () => void | (() => void),
    dependencies?: DependencyList,
  ): void;
  export function useMemo<T>(factory: () => T, dependencies: DependencyList): T;
  export function useRef<T>(initialValue: T): MutableRefObject<T>;
  export function useCallback<T extends (...args: any[]) => any>(
    callback: T,
    dependencies: DependencyList,
  ): T;
  export function startTransition(scope: () => void): void;
  export function useDeferredValue<T>(value: T): T;
  export const Fragment: any;
  const React: {
    Fragment: any;
  };
  export default React;
}

declare module 'react-dom/client' {
  export interface Root {
    render(node: any): void;
  }

  export function createRoot(container: Element | DocumentFragment): Root;
}

declare module 'react/jsx-runtime' {
  export const Fragment: any;
  export function jsx(type: any, props: any, key?: string): any;
  export function jsxs(type: any, props: any, key?: string): any;
  export function jsxDEV(type: any, props: any, key?: string): any;
}

declare namespace JSX {
  interface IntrinsicAttributes {
    key?: any;
  }

  interface IntrinsicElements {
    [elementName: string]: any;
  }
}
