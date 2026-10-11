
const { withEntitlementsPlist } = require('expo/config-plugins');
 
// Free Apple developer accounts cannot sign the Push Notifications entitlement.
// Breezy only uses local notifications, so remove aps-environment.
module.exports = (config) =>
  withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
 