import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {PhotoDeskFooter} from './PhotoDeskFooter';
import {get} from 'lodash';

import {broadcast} from './fields';

import {
    ItemPriority,
    ItemUrgency,
    MediaPreview,
    MediaInfo,
    PhotoDeskPreview,
    PhotoDeskInfo,
    GridTypeIcon,
    ListTypeIcon,
    ListPriority,
    ActionsMenu,
    ErrorBox,
    ProgressBar,
    ListItemInfo,
} from './index';
import {closeActionsMenu} from '../helpers';
import {DEFAULT_SWIMLANE_FIELDS_CONFIG} from '../constants';
import {SwimlaneField} from './SwimlaneField';

const actionsMenuDefaultTemplate = (toggle, stopEvent) => (
    <div className="item-right toolbox">
        <div className="item-actions-menu dropdown--big open">
            <button
                className={'more-activity-toggle condensed dropdown__toggle'}
                onClick={toggle}
                onDoubleClick={stopEvent}>
                <i className="icon-dots-vertical"></i>
            </button>
        </div>
    </div>
);

/**
 * Item component
 */
export class Item extends React.Component<any, any> {
    static propTypes: any;
    static defaultProps: any;

    constructor(props) {
        super(props);

        this.state = {hover: false, actioning: false, isActionMenuOpen: false};

        this.select = this.select.bind(this);
        this.edit = this.edit.bind(this);
        this.dbClick = this.dbClick.bind(this);
        this.setActioningState = this.setActioningState.bind(this);
        this.setHoverState = this.setHoverState.bind(this);
        this.unsetHoverState = this.unsetHoverState.bind(this);
        this.onDragStart = this.onDragStart.bind(this);
        this.openAuthoringView = this.openAuthoringView.bind(this);
    }

    componentWillMount() {
        const {config} = this.props.svc;

        if (get(this.props, 'svc.config.apps', []).includes('superdesk-planning')) {
            this.loadPlanningModals();
        }
    }

    componentWillUnmount() {
        closeActionsMenu(this.props.item._id);
    }

    componentWillReceiveProps(nextProps) {
        if (nextProps.item !== this.props.item) {
            closeActionsMenu(this.props.item._id);
        }
    }

    loadPlanningModals() {
        const {session, superdesk, activityService} = this.props.svc;

        if (!['add_to_planning', 'fulfil_assignment'].includes(get(this.props, 'item.lock_action')) ||
                get(this.props, 'item.lock_user') !== session.identity._id ||
                get(this.props, 'item.lock_session') !== session.sessionId) {
            return;
        }

        let planningActivity;
        const activities = superdesk.findActivities({action: 'list', type: 'archive'},
            this.props.item);

        // Planning: if page probably was refreshed / loaded during the add-to-planning operation,
        // reload the add-to-planning modal
        if (this.props.item.lock_action === 'add_to_planning') {
            planningActivity = activities.find((a) => a._id === 'planning.addto');
        } else if (this.props.item.lock_action === 'fulfil_assignment') {
            planningActivity = activities.find((a) => a._id === 'planning.fulfil');
        }

        if (planningActivity) {
            this.setActioningState(true);
            activityService.start(planningActivity, {data: {item: this.props.item}})
                .finally(() => this.setActioningState(false));
        }
    }

    shouldComponentUpdate(nextProps, nextState) {
        return nextProps.swimlane !== this.props.swimlane || nextProps.item !== this.props.item ||
            nextProps.view !== this.props.view ||
            nextProps.flags.selected !== this.props.flags.selected ||
            nextProps.narrow !== this.props.narrow ||
            nextState !== this.state;
    }

    select(event) {
        if (!this.props.item.gone) {
            this.props.onSelect(this.props.item, event);
        }
    }

    /**
     * Opens the item in authoring in view mode
     * @param {string} itemId Id of the document
     */
    openAuthoringView(itemId) {
        const {authoringWorkspace} = this.props.svc;

        authoringWorkspace.edit({_id: itemId}, 'view');
    }

    edit(event) {
        if (!this.props.item.gone) {
            this.props.onEdit(this.props.item);
        }
    }

    dbClick(event) {
        if (!this.props.item.gone) {
            this.props.onDbClick(this.props.item);
        }
    }

    /**
     * Set Actioning state
     * @param {Boolean} isActioning - true if activity is in-progress, and false if completed
     */
    setActioningState(isActioning) {
        this.setState({actioning: isActioning});
    }

    setHoverState() {
        this.setState({hover: true});
    }

    unsetHoverState() {
        this.setState({hover: false});
    }

    onDragStart(event) {
        const {dragitem} = this.props.svc;

        dragitem.start(event, this.props.item);
    }

    render() {
        const {item, scope} = this.props;
        let classes = this.props.view === 'photogrid' ?
            'sd-grid-item sd-grid-item--with-click' :
            'media-box media-' + item.type;

        // Customize item class from its props
        if (scope.customRender && typeof scope.customRender.getItemClass === 'function') {
            classes = `${classes} ${scope.customRender.getItemClass(item)}`;
        }

        const isLocked: boolean = (item.lock_user && item.lock_session) != null;

        const contents: any = [
            'div', {
                className: classNames(classes, {
                    active: this.props.flags.selected,
                    locked: isLocked,
                    selected: this.props.item.selected || this.props.flags.selected,
                    archived: item.archived || item.created,
                    gone: item.gone,
                    actioning: this.state.actioning,
                }),
            },
        ];

        const getActionsMenu = (template = actionsMenuDefaultTemplate) =>
            !get(scope, 'flags.hideActions') && this.state.hover && !item.gone ? React.createElement(
                ActionsMenu, {
                    item: item,
                    svc: this.props.svc,
                    scope: this.props.scope,
                    onActioning: this.setActioningState,
                    template: template,
                }) : null;

        if (this.props.view === 'swimlane2') {
            const swimlaneViewFieldsConfig = get(
                this.props.svc.config, 'swimlaneViewFields',
                DEFAULT_SWIMLANE_FIELDS_CONFIG,
            );

            const renderGroup = (groups) => {
                return groups.map((group, groupIndex) => (
                    <span
                        key={groupIndex}
                        className={classNames({
                            'sd-list-item__column': true,
                            'sd-list-item__column--grow': group.ellipsis === true,
                            'sd-list-item__column--no-border': groupIndex === groups.length - 1,
                        })}>
                        <span className="sd-list-item__row">
                            <span className={classNames({'sd-overflow-ellipsis': group.ellipsis === true})}>
                                {
                                    group.fields
                                        .map((field, fieldIndex) => (
                                            <SwimlaneField
                                                key={fieldIndex}
                                                fieldId={field}
                                                item={item}
                                                svc={this.props.svc}
                                            />
                                        ))
                                }
                            </span>
                        </span>
                    </span>
                ));
            };

            contents.push(
                <div className="sd-list-item" style={{borderBottom: '1px solid #e7e7e7'}}>
                    <span
                        style={{minWidth: '4px', maxWidth: '4px', background: isLocked ? '#e51c23' : 'transparent'}}>
                    </span>
                    {
                        item.archiveError
                            ? <span className="sd-list-item__column"><ErrorBox svc={this.props.svc} /></span>
                            : null
                    }
                    <span className="sd-list-item__column">
                        <ListTypeIcon
                            item={item}
                            onMultiSelect={this.props.onMultiSelect}
                            swimlane={this.props.swimlane}
                            svc={this.props.svc}
                        />
                    </span>
                    {renderGroup(swimlaneViewFieldsConfig.left)}
                    <span className="sd-list-item--element-grow"></span>
                    {renderGroup(swimlaneViewFieldsConfig.right)}
                    {
                        getActionsMenu((toggle, stopEvent) => (
                            <div className="sd-list-item__action-menu">
                                <button
                                    className="icn-btn"
                                    onClick={toggle}
                                    onDoubleClick={stopEvent}>
                                    <i className="icon-dots-vertical"></i>
                                </button>
                            </div>
                        ))
                    }
                </div>,
            );
        } else if (this.props.view === 'mgrid') {
            contents.push(
                item.archiveError ? React.createElement(ErrorBox, {svc: this.props.svc}) : null,
                React.createElement(MediaPreview, {
                    item: item,
                    desk: this.props.desk,
                    onMultiSelect: this.props.onMultiSelect,
                    swimlane: this.props.swimlane,
                    svc: this.props.svc,
                }),
                React.createElement(MediaInfo, {
                    item: item,
                    ingestProvider: this.props.ingestProvider,
                    svc: this.props.svc,
                }),
                React.createElement('div', {className: 'media-box__footer'},
                    React.createElement(GridTypeIcon, {item: item, svc: this.props.svc}),
                    item.priority ?
                        React.createElement(ItemPriority, angular.extend({svc: this.props.svc}, item)) : null,
                    item.urgency ?
                        React.createElement(ItemUrgency, angular.extend({svc: this.props.svc}, item)) : null,
                    broadcast({item: item}),
                    getActionsMenu(),
                ),
            );
        } else if (this.props.view === 'photogrid') {
            contents.push(
                item.archiveError ? React.createElement(ErrorBox, {svc: this.props.svc}) : null,
                React.createElement(PhotoDeskPreview, {
                    item: item,
                    desk: this.props.desk,
                    onMultiSelect: this.props.onMultiSelect,
                    swimlane: this.props.swimlane,
                    svc: this.props.svc,
                }),
                React.createElement(PhotoDeskInfo, {
                    item: item,
                    ingestProvider: this.props.ingestProvider,
                    svc: this.props.svc,
                }),
                React.createElement(PhotoDeskFooter, {
                    item: item,
                    svc: this.props.svc,
                    getActionsMenu: getActionsMenu,
                }),
                React.createElement('div',
                    {className: 'sd-grid-item__state-border'},
                ),
            );
        } else {
            contents.push(
                React.createElement('span', {className: 'state-border'}),
                React.createElement(ListTypeIcon, {
                    item: item,
                    onMultiSelect: this.props.onMultiSelect,
                    swimlane: this.props.swimlane,
                    svc: this.props.svc,
                }),
                item.priority || item.urgency ? React.createElement(ListPriority, {
                    item: item,
                    svc: this.props.svc,
                    scope: this.props.scope,
                }) : null,
                React.createElement(ListItemInfo, {
                    item: item,
                    openAuthoringView: this.openAuthoringView,
                    desk: this.props.desk,
                    ingestProvider: this.props.ingestProvider,
                    highlightsById: this.props.highlightsById,
                    markedDesksById: this.props.markedDesksById,
                    profilesById: this.props.profilesById,
                    swimlane: this.props.swimlane,
                    versioncreator: this.props.versioncreator,
                    narrow: this.props.narrow,
                    svc: this.props.svc,
                    scope: this.props.scope,
                }),
                getActionsMenu(),
            );
        }

        return React.createElement(
            'li', {
                id: item._id,
                key: item._id,
                className: classNames(
                    'list-item-view',
                    {active: this.props.flags.selected},
                    {selected: this.props.item.selected && !this.props.flags.selected},
                ),
                onMouseEnter: this.setHoverState,
                onMouseLeave: this.unsetHoverState,
                onDragStart: this.onDragStart,
                onClick: this.select,
                onDoubleClick: this.dbClick,
                draggable: true,
            },
            React.createElement.apply(null, contents),
        );
    }
}

Item.propTypes = {
    svc: PropTypes.object.isRequired,
    scope: PropTypes.any.isRequired,
    swimlane: PropTypes.any,
    item: PropTypes.any,
    profilesById: PropTypes.any,
    highlightsById: PropTypes.any,
    markedDesksById: PropTypes.any,
    ingestProvider: PropTypes.any,
    versioncreator: PropTypes.any,
    onMultiSelect: PropTypes.any,
    desk: PropTypes.any,
    flags: PropTypes.any,
    view: PropTypes.any,
    onDbClick: PropTypes.any,
    onEdit: PropTypes.any,
    onSelect: PropTypes.any,
    narrow: PropTypes.any,
};
