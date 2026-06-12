/** Admin-scoped routes for the content-helper plugin. */
export default [
  {
    method: 'GET',
    path: '/preview',
    handler: 'controller.preview',
    config: { policies: ['admin::isAuthenticatedAdmin'] },
  },
  {
    method: 'POST',
    path: '/apply',
    handler: 'controller.apply',
    config: { policies: ['admin::isAuthenticatedAdmin'] },
  },
];
