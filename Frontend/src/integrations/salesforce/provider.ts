import type { SalesforceMenuItem, SalesforceRestaurant } from './types';
export interface RestaurantDataProvider {
  createRestaurant(data: SalesforceRestaurant): Promise<unknown>;
  updateRestaurant(data: SalesforceRestaurant): Promise<unknown>;
  syncMenu(data: SalesforceMenuItem): Promise<unknown>;
}
// The real Salesforce provider is intentionally a boundary until credentials and object mappings are supplied.
export class SalesforceProvider implements RestaurantDataProvider {
  async createRestaurant(): Promise<never> { throw new Error('Real Salesforce credentials and object mappings are not configured'); }
  async updateRestaurant(): Promise<never> { throw new Error('Real Salesforce credentials and object mappings are not configured'); }
  async syncMenu(): Promise<never> { throw new Error('Real Salesforce credentials and object mappings are not configured'); }
}
export class DevelopmentSalesforceProvider implements RestaurantDataProvider {
  async createRestaurant(data: SalesforceRestaurant) { return data; }
  async updateRestaurant(data: SalesforceRestaurant) { return data; }
  async syncMenu(data: SalesforceMenuItem) { return data; }
}
export const salesforceProvider: RestaurantDataProvider = process.env.SALESFORCE_PROVIDER === 'real' ? new SalesforceProvider() : new DevelopmentSalesforceProvider();
