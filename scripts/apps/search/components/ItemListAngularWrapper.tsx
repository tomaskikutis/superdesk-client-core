import React from 'react';
import {forOwn, startsWith} from 'lodash';
import ng from 'core/services/ng';
import {ItemList} from 'apps/search/components';
import {
    IArticle,
    IWebsocketMessage,
    IResourceCreatedEvent,
    IResourceUpdateEvent,
    IResourceDeletedEvent,
} from 'superdesk-api';
import {
    IRelatedEntities,
    getAndMergeRelatedEntitiesForArticles,
    IResourceChange,
    getAndMergeRelatedEntitiesUpdated,
} from 'core/getRelatedEntities';
import {addWebsocketEventListener} from 'core/notification/notification';
import {throttleAndCombineArray} from 'core/itemList/throttleAndCombine';

interface IProps {
    scope: any;
    monitoringState: any;
}

interface IState {
    narrow: boolean;
    view: 'compact' | 'mgrid' | 'photogrid';
    itemsList: Array<string>;
    itemsById: any;
    relatedEntities: IRelatedEntities;
    selected: string;
    swimlane: any;
    actioning: {};
    loading: boolean;
}

export class ItemListAngularWrapper extends React.Component<IProps, IState> {
    componentRef: ItemList;
    private abortController: AbortController;
    private eventListenersToRemoveBeforeUnmounting: Array<() => void>;
    private handleContentChanges: (changes: Array<IResourceChange>) => void;

    constructor(props: IProps) {
        super(props);

        this.state = {
            itemsList: [],
            itemsById: {},
            relatedEntities: {},
            selected: null,
            view: 'compact',
            narrow: false,
            swimlane: null,
            actioning: {},
            loading: true,
        };

        this.focus = this.focus.bind(this);
        this.setActioning = this.setActioning.bind(this);
        this.findItemByPrefix = this.findItemByPrefix.bind(this);
        this.setNarrowView = this.setNarrowView.bind(this);
        this.updateItem = this.updateItem.bind(this);
        this.updateAllItems = this.updateAllItems.bind(this);
        this.multiSelect = this.multiSelect.bind(this);

        this.abortController = new AbortController();
        this.eventListenersToRemoveBeforeUnmounting = [];

        this.handleContentChanges = throttleAndCombineArray(
            (changes) => {
                getAndMergeRelatedEntitiesUpdated(
                    this.state.relatedEntities,
                    changes,
                    this.abortController.signal,
                ).then((relatedEntities) => {
                    this.setState({relatedEntities});
                });
            },
            300,
        );
    }

    focus() {
        this.componentRef?.focus();
    }

    setActioning(item: IArticle, isActioning: boolean) {
        this.componentRef?.setActioning(item, isActioning);
    }

    findItemByPrefix(prefix) {
        let item;

        forOwn(this.state.itemsById, (val, key) => {
            if (startsWith(key, prefix)) {
                item = val;
            }
        });

        return item;
    }

    setNarrowView(setNarrow) {
        this.setState({narrow: setNarrow});
    }

    updateItem(itemId, changes) {
        const item = this.state.itemsById[itemId] || null;

        if (item) {
            const itemsById = angular.extend({}, this.state.itemsById);
            const updatedItem: IArticle = angular.extend({}, item, changes);

            itemsById[itemId] = updatedItem;

            getAndMergeRelatedEntitiesForArticles(
                [updatedItem],
                this.state.relatedEntities,
                this.abortController.signal,
            ).then((relatedEntities) => {
                this.setState({
                    itemsById,
                    relatedEntities,
                });
            });
        }
    }

    updateAllItems(itemId, changes) {
        const itemsById = angular.extend({}, this.state.itemsById);
        const updatedItems = [];

        forOwn(itemsById, (value, key) => {
            if (startsWith(key, itemId)) {
                itemsById[key] = angular.extend({}, value, changes);
                updatedItems.push(itemsById[key]);
            }
        });

        getAndMergeRelatedEntitiesForArticles(
            updatedItems,
            this.state.relatedEntities,
            this.abortController.signal,
        ).then((relatedEntities) => {
            this.setState({
                itemsById,
                relatedEntities,
            });
        });
    }

    multiSelect(items: Array<IArticle>, selected: boolean) {
        const search = ng.get('search');
        const multi = ng.get('multi');

        let {selected: selectedId} = this.state;

        const itemsById = angular.extend({}, this.state.itemsById);

        items.forEach((item, i) => {
            const itemId = search.generateTrackByIdentifier(item);

            if (selected && i === items.length - 1) {
                // Mark last item as selected
                selectedId = itemId;
            }
            itemsById[itemId] = angular.extend({}, item, {selected: selected});
            this.props.scope.$applyAsync(() => {
                multi.toggle(itemsById[itemId]);
            });
        });

        this.setState({itemsById, selected: selectedId});
    }

    componentDidMount() {
        this.eventListenersToRemoveBeforeUnmounting.push(
            addWebsocketEventListener(
                'resource:created',
                (event: IWebsocketMessage<IResourceCreatedEvent>) => {
                    const {resource, _id} = event.extra;

                    this.handleContentChanges([{changeType: 'created', resource: resource, itemId: _id}]);
                },
            ),
        );

        this.eventListenersToRemoveBeforeUnmounting.push(
            addWebsocketEventListener(
                'resource:updated',
                (event: IWebsocketMessage<IResourceUpdateEvent>) => {
                    const {resource, _id, fields} = event.extra;

                    this.handleContentChanges([{changeType: 'updated', resource: resource, itemId: _id, fields}]);
                },
            ),
        );

        this.eventListenersToRemoveBeforeUnmounting.push(
            addWebsocketEventListener(
                'resource:deleted',
                (event: IWebsocketMessage<IResourceDeletedEvent>) => {
                    const {resource, _id} = event.extra;

                    this.handleContentChanges([{changeType: 'deleted', resource: resource, itemId: _id}]);
                },
            ),
        );
    }

    componentWillUnmount() {
        this.abortController.abort();

        this.eventListenersToRemoveBeforeUnmounting.forEach((removeListener) => {
            removeListener();
        });
    }

    render() {
        const {scope, monitoringState} = this.props;

        return (
            <ItemList
                itemsList={this.state.itemsList}
                itemsById={this.state.itemsById}
                relatedEntities={this.state.relatedEntities}
                profilesById={monitoringState.state.profilesById}
                highlightsById={monitoringState.state.highlightsById}
                markedDesksById={monitoringState.state.markedDesksById}
                desksById={monitoringState.state.desksById}
                ingestProvidersById={monitoringState.state.ingestProvidersById}
                usersById={monitoringState.state.usersById}
                onMonitoringItemSelect={scope.onMonitoringItemSelect}
                onMonitoringItemDoubleClick={scope.onMonitoringItemDoubleClick}
                hideActionsForMonitoringItems={scope.hideActionsForMonitoringItems}
                singleLine={scope.singleLine}
                customRender={scope.customRender}
                flags={scope.flags}
                loading={this.state.loading}
                viewColumn={scope.viewColumn}
                groupId={scope.$id}
                edit={scope.edit}
                preview={scope.preview}
                multiSelect={scope.disableMonitoringMultiSelect ? undefined : {
                    kind: 'legacy',
                    multiSelect: this.multiSelect,
                    setSelectedItem: (itemId) => {
                        this.setState({selected: itemId});
                    },
                }}
                narrow={this.state.narrow}
                view={this.state.view}
                selected={this.state.selected}
                swimlane={this.state.swimlane}
                scopeApply={(callback) => {
                    scope.$apply(callback);
                }}
                scopeApplyAsync={(callback) => {
                    scope.$applyAsync(callback);
                }}
                ref={(component) => {
                    this.componentRef = component;
                }}
            />
        );
    }
}
