import test from 'node:test';
import assert from 'node:assert/strict';
import { DevelopmentSalesforceProvider } from '../src/integrations/salesforce/provider';

test('development Salesforce provider returns the supplied source record', async () => {
  const provider = new DevelopmentSalesforceProvider();
  const restaurant = { externalId: 'SF-REST-001', name: 'Anbude Cafe' };
  assert.deepEqual(await provider.createRestaurant(restaurant), restaurant);
  const menu = { externalId: 'SF-MENU-001', restaurantExternalId: 'SF-REST-001', name: 'Biryani', foodType: 'NON_VEG' as const, price: 180 };
  assert.deepEqual(await provider.syncMenu(menu), menu);
});
