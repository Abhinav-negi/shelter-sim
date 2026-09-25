import type { Options } from '@shelter/studio-server';
import { get } from './client';

export const getOptions = () => get<Options>('/options');
