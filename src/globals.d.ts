/**
 * JSX typing for the classic transform.
 *
 * The bundle compiles JSX to `React.createElement` (so the browser never has to
 * resolve `react/jsx-runtime`), and React 19 ships its element types under the
 * `React` namespace only — this re-attaches them globally.
 */
import type * as ReactTypes from 'react'

declare global {
  namespace JSX {
    type Element = ReactTypes.JSX.Element
    type ElementType = ReactTypes.JSX.ElementType
    interface ElementClass extends ReactTypes.JSX.ElementClass {}
    interface ElementAttributesProperty extends ReactTypes.JSX.ElementAttributesProperty {}
    interface ElementChildrenAttribute extends ReactTypes.JSX.ElementChildrenAttribute {}
    interface IntrinsicAttributes extends ReactTypes.JSX.IntrinsicAttributes {}
    interface IntrinsicClassAttributes<T> extends ReactTypes.JSX.IntrinsicClassAttributes<T> {}
    interface IntrinsicElements extends ReactTypes.JSX.IntrinsicElements {}
  }
}

export {}
