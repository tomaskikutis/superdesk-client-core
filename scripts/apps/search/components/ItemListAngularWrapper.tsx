import React from 'react';
import {forOwn, startsWith, indexOf} from 'lodash';
import ng from 'core/services/ng';
import {ItemList} from 'apps/search/components';
import {IArticle} from 'superdesk-api';
import {isCheckAllowed} from '../helpers';
import {SmoothLoader} from './SmoothLoader';

interface IProps {
    scope: any;
    monitoringState: any;
}

interface IState {
    narrow: boolean;
    view: 'compact' | 'mgrid' | 'photogrid';
    itemsList: Array<string>;
    itemsById: any;
    selected: string;
    swimlane: any;
    actioning: {};
    loading: boolean;
}

export class ItemListAngularWrapper extends React.Component<IProps, IState> {
    componentRef: ItemList;

    constructor(props: IProps) {
        super(props);

        this.state = {
            itemsList: [],
            itemsById: {},
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
        this.selectMultipleItems = this.selectMultipleItems.bind(this);
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

            itemsById[itemId] = angular.extend({}, item, changes);
            this.setState({itemsById: itemsById});
        }
    }

    updateAllItems(itemId, changes) {
        const itemsById = angular.extend({}, this.state.itemsById);

        forOwn(itemsById, (value, key) => {
            if (startsWith(key, itemId)) {
                itemsById[key] = angular.extend({}, value, changes);
            }
        });

        this.setState({itemsById: itemsById});
    }

    selectMultipleItems(lastItem: IArticle) {
        const {itemsList, itemsById, selected} = this.state;

        const search = ng.get('search');
        const itemId = search.generateTrackByIdentifier(lastItem);
        let positionStart = 0;
        const positionEnd = indexOf(itemsList, itemId);
        const selectedItems = [];

        if (selected) {
            positionStart = indexOf(itemsList, selected);
        }

        const start = Math.min(positionStart, positionEnd);
        const end = Math.max(positionStart, positionEnd);

        for (let i = start; i <= end; i++) {
            const item = itemsById[itemsList[i]];

            if (isCheckAllowed(item)) {
                selectedItems.push(item);
            }
        }

        this.multiSelect(selectedItems, true);
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

    render() {
        const {scope, monitoringState} = this.props;

        return (
            <SmoothLoader loading={this.state.loading}>
                <div style={scope.style ?? {}}>
                    <ItemList
                        itemsList={this.state.itemsList}
                        itemsById={this.state.itemsById}
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
                            multiSelect: (item: IArticle, selected: boolean, multiSelectMode: boolean) => {
                                if (multiSelectMode) {
                                    this.selectMultipleItems(item);
                                } else {
                                    this.multiSelect([item], selected);
                                }
                            },
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
                </div>
            </SmoothLoader>
        );
    }
}
