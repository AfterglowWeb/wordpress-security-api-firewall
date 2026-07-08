import { type Component } from '@wordpress/element';

export type ChildrenProps = {
    children: ConstructorParameters<typeof Component>[0] extends { children?: infer C } ? C : never;
};