import React from 'react';
import {noop, omit} from 'lodash';
import ReactPaginate from 'react-paginate';

import {ListItem, ListItemColumn} from 'core/components/ListItem';
import {PageContainer, PageContainerItem} from 'core/components/PageLayout';
import {GenericListPageItemViewEdit} from './generic-list-page-item-view-edit';
import {
    SidePanelHeader,
    SidePanel,
    SidePanelHeading,
    SidePanelTools,
    SidePanelContent,
    SidePanelContentBlock
} from 'core/components/SidePanel';
import {SearchBar} from 'core/ui/components';
import {Button} from 'core/ui/components/Nav';
import {SortBar, ISortFields} from 'core/ui/components/SortBar';
import {connectCrudManager, ICrudManager} from 'core/helpers/CrudManager';
import {TagLabel} from 'core/ui/components/TagLabel';
import {connectServices} from 'core/helpers/ReactRenderAsync';
import {IFormGroup} from 'core/ui/components/generic-form/interfaces/form';
import {getFormGroupForFiltering} from 'core/ui/components/generic-form/get-form-group-for-filtering';
import {getFormFieldsRecursive} from 'core/ui/components/generic-form/form-field';
import {FormViewEdit} from 'core/ui/components/generic-form/from-group';
import {IDefaultApiFields} from 'types/RestApi';
import {getInitialValues} from '../generic-form/get-initial-values';

interface IState {
    itemInPreview?: string;
    newItem: null | {[key: string]: any};
    filtersOpen: boolean;
    filterValues: {[key: string]: any};
    searchValue: string;
    loading: boolean;
}

interface IProps<T extends IDefaultApiFields> {
    formConfig: IFormGroup;
    renderRow(key: string, item: T, page: GenericListPageComponent<T>): JSX.Element;

    // Allows creating an item with required fields which aren't editable from the GUI
    newItemTemplate?: {[key: string]: any};

    // connected
    items?: ICrudManager<T>;
    modal?: any;
}

export class GenericListPageComponent<T extends IDefaultApiFields> extends React.Component<IProps<T>, IState> {
    previewInEditMode: boolean;

    constructor(props) {
        super(props);

        this.state = {
            itemInPreview: null,
            newItem: null,
            filtersOpen: false,
            filterValues: {},
            searchValue: '',
            loading: true,
        };

        this.previewInEditMode = false;

        this.openPreview = this.openPreview.bind(this);
        this.closePreview = this.closePreview.bind(this);
        this.setFiltersVisibility = this.setFiltersVisibility.bind(this);
        this.handleFilterFieldChange = this.handleFilterFieldChange.bind(this);
        this.openNewItemForm = this.openNewItemForm.bind(this);
        this.closeNewItemForm = this.closeNewItemForm.bind(this);
        this.deleteItem = this.deleteItem.bind(this);
    }
    openPreview(id) {
        if (this.previewInEditMode === true) {
            this.props.modal.alert({
                headerText: gettext('Warning'),
                bodyText: gettext(
                    'Can\'t open a preview, because another item is in edit mode.',
                ),
            });
        } else {
            this.setState({
                itemInPreview: id,
            });
        }
    }
    deleteItem(item: T) {
        this.props.modal.confirm(gettext('Are you sure you want to delete this item?')).then(() => {
            this.props.items.delete(item);
        });
    }
    startEditing(id) {
        if (this.previewInEditMode === true) {
            this.props.modal.alert({
                headerText: gettext('Warning'),
                bodyText: gettext(
                    'Can\'t edit this item, because another item is in edit mode.',
                ),
            });
        } else {
            this.setState({
                itemInPreview: id,
            });
        }
    }
    closePreview() {
        this.setState({itemInPreview: null});
    }
    handleFilterFieldChange(field, nextValue, callback = noop) {
        this.setState({
            filterValues: {
                ...this.state.filterValues,
                [field]: nextValue,
            },
        }, callback);
    }
    executeFilters() {
        this.props.items.read(
            1,
            this.props.items.activeSortOption,
            this.state.filterValues,
        );
    }
    closeNewItemForm() {
        this.setState({newItem: null});
    }
    setFiltersVisibility(nextValue: boolean) {
        this.setState({filtersOpen: nextValue});
    }
    openNewItemForm() {
        if (this.previewInEditMode === true) {
            this.props.modal.alert({
                headerText: gettext('Warning'),
                bodyText: gettext(
                    'Can\'t add a new item, because another item is in edit mode.',
                ),
            });
        } else {
            this.setState({
                newItem: {
                    ...getInitialValues(this.props.formConfig),
                    ...this.props.newItemTemplate == null ? {} : this.props.newItemTemplate,
                },
                itemInPreview: null,
            });
        }
    }
    componentDidMount() {
        this.props.items.read(1);
    }
    render() {
        if (this.props.items._items == null) {
            // loading
            return null;
        }

        const {activeFilters} = this.props.items;
        const totalResults = this.props.items._meta.total;
        const pageSize = this.props.items._meta.max_results;
        const pageCount = Math.ceil(totalResults / pageSize);

        const {formConfig, renderRow} = this.props;

        const formConfigForFilters = getFormGroupForFiltering(formConfig);
        const fieldsList = getFormFieldsRecursive(formConfig.form);

        const sortOptions: Array<ISortFields> = [
            ...fieldsList.map(({label, field}) => ({label, field})),
            {
                label: gettext('Last updated'),
                field: '_updated',
            },
            {
                label: gettext('First created'),
                field: '_created',
            },
        ];

        const getContents = () => {
            if (this.props.items._items.length === 0) {
                if (Object.keys(activeFilters).length > 0) {
                    return (
                        <ListItem noHover>
                            <ListItemColumn>
                                {gettext('There are no items matching the search.')}
                            </ListItemColumn>
                        </ListItem>
                    );
                } else {
                    return (
                        <ListItem noHover>
                            <ListItemColumn>
                                {gettext('There are no items yet.')}
                            </ListItemColumn>
                        </ListItem>
                    );
                }
            } else {
                return this.props.items._items.map(
                    (item) => renderRow(item._id, item, this),
                );
            }
        };

        return (
            <div style={{display: 'flex', flexDirection: 'column', width: '100%'}}>
                <div className="subnav">
                    <Button
                        icon="icon-filter-large"
                        onClick={() => this.setFiltersVisibility(!this.state.filtersOpen)}
                        active={this.state.filtersOpen}
                        darker={true}
                    />

                    <SearchBar
                        value={this.state.searchValue}
                        allowCollapsed={false}
                        onSearch={(value) => {
                            this.handleFilterFieldChange('name', value, this.executeFilters);
                        }}
                    />

                    <SortBar
                        sortOptions={sortOptions}
                        selected={this.props.items.activeSortOption}
                        itemsCount={this.props.items._meta.total}
                        onSortOptionChange={this.props.items.sort}
                    />

                    <Button
                        onClick={this.openNewItemForm}
                        className="sd-create-btn dropdown-toggle"
                        icon="icon-plus-large"
                    >
                        <span className="circle" />
                    </Button>
                </div>
                <PageContainer>
                    {
                        this.state.filtersOpen ? (
                            <PageContainerItem>
                                <SidePanel side="left" width={240}>
                                    <SidePanelHeader>
                                        <SidePanelHeading>{gettext('Refine search')}</SidePanelHeading>
                                        <SidePanelTools>
                                            <button
                                                className="icn-btn"
                                                onClick={() => this.setFiltersVisibility(false)}
                                            >
                                                <i className="icon-close-small" />
                                            </button>
                                        </SidePanelTools>
                                    </SidePanelHeader>
                                    <SidePanelContent>
                                        <SidePanelContentBlock>
                                            <form onSubmit={(event) => {
                                                event.preventDefault();
                                                this.executeFilters();
                                            }}>
                                                <FormViewEdit
                                                    item={this.state.filterValues}
                                                    formConfig={formConfigForFilters}
                                                    editMode={true}
                                                    issues={{}}
                                                    handleFieldChange={this.handleFilterFieldChange}
                                                />
                                                <button className="btn btn--primary btn--expanded" type="submit">
                                                    {gettext('Filter')}
                                                </button>
                                            </form>
                                        </SidePanelContentBlock>
                                    </SidePanelContent>
                                </SidePanel>
                            </PageContainerItem>
                        ) : null
                    }
                    <PageContainerItem shrink>
                        <div style={{margin: 20}}>
                            {
                                this.props.items._items.length === 0 ? null : (
                                    <div style={{textAlign: 'center', marginTop: -20}}>
                                        <ReactPaginate
                                            previousLabel={gettext('prev')}
                                            nextLabel={gettext('next')}
                                            pageCount={pageCount}
                                            marginPagesDisplayed={2}
                                            pageRangeDisplayed={5}
                                            onPageChange={({selected}) => {
                                                this.props.items.goToPage(selected + 1);
                                            }}
                                            initialPage={this.props.items._meta.page - 1}
                                            containerClassName={'bs-pagination'}
                                            activeClassName="active"
                                        />
                                    </div>
                                )
                            }
                            {
                                Object.keys(activeFilters).length < 1 ? null : (
                                    <div
                                        className="subnav"
                                        style={{background: 'transparent', boxShadow: 'none', marginTop: -20}}
                                    >
                                        {
                                            Object.keys(activeFilters).map((fieldName, i) => (
                                                <TagLabel
                                                    key={i}
                                                    onRemove={() => {
                                                        this.setState({
                                                            filterValues: omit(this.state.filterValues, [fieldName]),
                                                        });
                                                        this.props.items.removeFilter(fieldName);
                                                    }}
                                                >
                                                    {fieldName}:{' '}<strong>{activeFilters[fieldName]}</strong>
                                                </TagLabel>
                                            ))
                                        }
                                    </div>
                                )
                            }
                            {getContents()}
                        </div>
                    </PageContainerItem>

                    {
                        this.state.itemInPreview != null ? (
                            <PageContainerItem>
                                <GenericListPageItemViewEdit
                                    onEditModeChange={(val) => {
                                        this.previewInEditMode = val;
                                    }}
                                    operation="editing"
                                    formConfig={formConfig}
                                    item={
                                        this.props.items._items.find(({_id}) => _id === this.state.itemInPreview)
                                    }
                                    onSave={(nextItem) => this.props.items.update(nextItem)}
                                    onClose={this.closePreview}
                                />
                            </PageContainerItem>
                        ) : null
                    }

                    {
                        this.state.newItem != null ? (
                            <PageContainerItem>
                                <GenericListPageItemViewEdit
                                    operation="creation"
                                    formConfig={formConfig}
                                    item={this.state.newItem}
                                    onSave={(item: T) => this.props.items.create(item).then((res) => {
                                        this.closeNewItemForm();
                                        this.openPreview(res._id);
                                    })}
                                    onClose={this.closeNewItemForm}
                                    onCancel={this.closeNewItemForm}
                                />
                            </PageContainerItem>
                        ) : null
                    }
                </PageContainer>
            </div>
        );
    }
}

export const getGenericListPageComponent = <T extends IDefaultApiFields>(resource: string) =>
    connectServices<IProps<T>>(
        connectCrudManager<IProps<T>, T>(
            GenericListPageComponent,
            'items',
            resource,
        )
        , ['modal'],
    );
