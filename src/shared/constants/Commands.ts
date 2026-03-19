export const Commands = {
  DAG: {
    REFRESH: 'dagTreeView.refreshServer',
    CONNECT: 'dagTreeView.connectServer',
    ADD_SERVER: 'dagTreeView.addServer',
    REMOVE_SERVER: 'dagTreeView.removeServer',
    FILTER: 'dagTreeView.filter',
    SHOW_ACTIVE: 'dagTreeView.showOnlyActive',
    SHOW_FAVORITE: 'dagTreeView.showOnlyFavorite',
    TRIGGER: 'dagTreeView.triggerDag',
    TRIGGER_WITH_CONFIG: 'dagTreeView.triggerDagWithConfig',
    PAUSE: 'dagTreeView.pauseDAG',
    UNPAUSE: 'dagTreeView.unPauseDAG',
    CANCEL: 'dagTreeView.cancelDagRun',
    VIEW_LOGS: 'dagTreeView.lastDAGRunLog',
    VIEW_SOURCE: 'dagTreeView.dagSourceCode',
    VIEW_INFO: 'dagTreeView.showDagInfo',
    ADD_FAVORITE: 'dagTreeView.addToFavDAG',
    REMOVE_FAVORITE: 'dagTreeView.deleteFromFavDAG',
    VIEW_DETAILS: 'dagTreeView.viewDagView',
  },
  ADMIN: {
    VIEW_CONNECTIONS: 'dagTreeView.viewConnections',
    VIEW_VARIABLES: 'dagTreeView.viewVariables',
    VIEW_PROVIDERS: 'dagTreeView.viewProviders',
    VIEW_HEALTH: 'dagTreeView.viewServerHealth',
  },
} as const;

export const ViewIds = {
  DAG_TREE: 'dagTreeView',
  ADMIN_TREE: 'adminTreeView',
} as const;

export const OutputChannelName = 'Airflow';
