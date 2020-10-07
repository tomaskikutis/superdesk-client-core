/* eslint-disable react/no-multi-comp */

import React from 'react';
import ng from 'core/services/ng';
import {IArticle, IResourceUpdateEvent, IWebsocketMessage} from 'superdesk-api';

import {noop, throttle} from 'lodash';
import {LazyLoader} from './itemList/LazyLoader';
import {IMultiSelectNew, ItemList} from 'apps/search/components/ItemList';
import {addWebsocketEventListener} from './notification/notification';
import {dataApi} from './helpers/CrudManager';
import {IScope} from 'angular';

interface IState {
    initialized: boolean;
}

interface IProps {
    itemCount: number;
    pageSize: number;
    padding?: string;
    loadItems(start: number, end: number): Promise<Array<IArticle>>;
    shouldReloadTheList?(fieldsChanged: Set<string>): boolean;

    onItemClick(item: IArticle): void;
    onItemDoubleClick?(item: IArticle): void;
    multiSelect?: IMultiSelectNew;
}

export class ArticlesListV2 extends React.Component<IProps, IState> {
    monitoringState: any;
    lazyLoaderRef: LazyLoader<IArticle>;
    removeContentUpdateListener: () => void;
    handleContentUpdateThrottled: (event: IWebsocketMessage<IResourceUpdateEvent>) => void;

    constructor(props: any) {
        super(props);

        this.state = {
            initialized: false,
        };

        this.monitoringState = ng.get('monitoringState');

        this.loadMore = this.loadMore.bind(this);

        // Multiple items can be updated at once.
        this.handleContentUpdateThrottled = throttle(
            (event: IWebsocketMessage<IResourceUpdateEvent>) => {
                const {extra} = event;

                if (
                    extra.resource === 'archive'
                    || extra.resource === 'archive_unspike'
                ) {
                    const reloadTheList = this.props?.shouldReloadTheList(
                        new Set(Array.from(Object.keys(extra.fields))),
                    ) ?? false;

                    if (reloadTheList) {
                        this.lazyLoaderRef.reset();
                    } else {
                        this.lazyLoaderRef.updateItems(new Set([extra._id]));
                    }
                }
            },
            500,
        );
    }

    loadMore(from: number, to: number) {
        const {loadItems} = this.props;

        return new Promise<Dictionary<string, IArticle>>((resolve) => {
            loadItems(from, to).then((items) => {
                const patch = items.reduce<{[key: string]: IArticle}>((acc, item, index) => {
                    acc[from + index] = item;

                    return acc;
                }, {});

                resolve(patch);
            });
        });
    }

    componentDidMount() {
        this.monitoringState.init().then(() => {
            this.setState({initialized: true});
        });
    }

    componentWillUnmount() {
        this.removeContentUpdateListener();
    }

    render() {
        if (this.state.initialized !== true) {
            return null;
        }

        const {itemCount, pageSize} = this.props;

        return (
            <LazyLoader
                itemCount={itemCount}
                loadMoreItems={this.loadMore}
                pageSize={pageSize}
                getId={(item) => item._id}
                getItemsByIds={(ids) => {
                    return Promise.all(
                        ids.map((id) => dataApi.findOne<IArticle>('search', id)),
                    );
                }}
                ref={(component) => {
                    this.lazyLoaderRef = component;

                    if (this.lazyLoaderRef != null && this.removeContentUpdateListener == null) {
                        // wouldn't work in componentDidMount, because this.state.loading would be true
                        // and LazyLoader wouldn't be mounted at that point yet.
                        this.removeContentUpdateListener = addWebsocketEventListener(
                            'resource:updated',
                            this.handleContentUpdateThrottled,
                        );
                    }
                }}
                padding={this.props.padding}
            >
                {(items) => {
                    return (
                        <ItemList
                            itemsList={Object.keys(items)}
                            itemsById={items}
                            profilesById={this.monitoringState.state.profilesById}
                            highlightsById={this.monitoringState.state.highlightsById}
                            markedDesksById={this.monitoringState.state.markedDesksById}
                            desksById={this.monitoringState.state.desksById}
                            ingestProvidersById={this.monitoringState.state.ingestProvidersById}
                            usersById={this.monitoringState.state.usersById}
                            onMonitoringItemSelect={this.props.onItemClick}
                            onMonitoringItemDoubleClick={this.props.onItemDoubleClick ?? noop}
                            hideActionsForMonitoringItems={false}
                            singleLine={false}
                            customRender={undefined}
                            viewType={undefined}
                            flags={{hideActions: false}}
                            loading={false}
                            viewColumn={undefined}
                            groupId={undefined}
                            edit={noop}
                            preview={noop}
                            multiSelect={this.props.multiSelect}
                            narrow={false}
                            view={undefined}
                            selected={undefined}
                            swimlane={false}
                            scopeApply={(fn) => {
                                const $rootScope: IScope = ng.get('$rootScope');

                                $rootScope.$apply(fn);
                            }}
                            scopeApplyAsync={(fn) => {
                                const $rootScope: IScope = ng.get('$rootScope');

                                $rootScope.$applyAsync(fn);
                            }}
                        />
                    );
                }}
            </LazyLoader>
        );
    }
}
