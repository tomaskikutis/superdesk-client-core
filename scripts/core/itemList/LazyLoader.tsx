import React from 'react';
import {gettext} from 'core/utils';

interface IProps<T> {
    pageSize: number;
    itemCount: number;
    padding?: string;
    getId(item: T): string;
    getItemsByIds(ids: Array<string>): Promise<Array<T>>;
    loadMoreItems(from: number, to: number): Promise<Dictionary<string, T>>;
    children: (items: Dictionary<string, T>) => JSX.Element;
}

interface IState<T> {
    items: Dictionary<string, T>;
    loading: boolean;
}

const messageStyles: React.CSSProperties = {
    padding: 20,
    textAlign: 'center',
    backgroundColor: 'white',
    borderTop: '1px solid #ebebeb',
};

function hasScrollbar(element: Element) {
    return element.clientHeight < element.scrollHeight;
}

export class LazyLoader<T> extends React.Component<IProps<T>, IState<T>> {
    indexesById: Dictionary<string, string>; // id, index
    containerRef: any;

    constructor(props: IProps<T>) {
        super(props);

        this.state = {
            items: {},
            loading: true,
        };

        this.loadMore = this.loadMore.bind(this);
        this.allItemsLoaded = this.allItemsLoaded.bind(this);
        this.getLoadedItemsCount = this.getLoadedItemsCount.bind(this);
    }

    public updateItems(ids: Set<string>) {
        const {getId} = this.props;
        const onlyLoadedIds = Object.keys(this.indexesById).filter((id) => ids.has(id));

        this.props.getItemsByIds(onlyLoadedIds).then((res) => {
            const updates = res.reduce<Dictionary<string, T>>((acc, item) => {
                acc[this.indexesById[getId(item)]] = item;

                return acc;
            }, {});

            this.setState({
                items: {
                    ...this.state.items,
                    ...updates,
                },
            });
        });
    }

    public reset() {
        this.setState({
            items: {}, // TODO: display current items while loading
            loading: true,
        }, () => {
            this.loadMore();
        });
    }

    private loadMore() {
        this.setState({loading: true});

        const {items} = this.state;
        const from = Object.keys(items).length;
        const to = from + this.props.pageSize;

        this.props.loadMoreItems(from, to).then((moreItems) => {
            this.setState({
                items: {
                    ...this.state.items,
                    ...moreItems,
                },
                loading: false,
            });
        });
    }

    private allItemsLoaded() {
        const {items} = this.state;
        const from = Object.keys(items).length;
        const loadedCount = Object.keys(items).length;

        return Math.max(from, loadedCount) >= this.props.itemCount;
    }

    private getLoadedItemsCount() {
        return Object.keys(this.state.items).length;
    }

    componentDidMount() {
        this.loadMore();
    }

    componentDidUpdate(prevProps: IProps<T>, prevState: IState<T>) {
        if (this.state.items !== prevState.items) {
            // update indexesById

            const {items} = this.state;
            const {getId} = this.props;

            this.indexesById = {};

            for (const key in items) {
                const item = items[key];

                this.indexesById[getId(item)] = key;
            }

            // Ensure there are enough items for the scrollbar to appear.
            // Lazy loading wouldn't work otherwise because it depends on "scroll" event firing.
            if (hasScrollbar(this.containerRef) !== true && this.allItemsLoaded() !== true) {
                this.loadMore();
            }
        }
    }

    render() {
        const {loading, items} = this.state;

        return (
            <div style={{display: 'flex', flexDirection: 'column', maxHeight: '100%', position: 'relative'}}>
                <div
                    style={{
                        maxHeight: '100%',
                        overflow: 'auto',
                        flexGrow: 1,
                        padding: this.props.padding ?? '0',
                    }}
                    onScroll={(event) => {
                        if (loading || this.allItemsLoaded()) {
                            return;
                        }

                        const {scrollHeight, offsetHeight, scrollTop} = (event.target as any);
                        const reachedBottom = scrollHeight === offsetHeight + scrollTop;

                        if (reachedBottom) {
                            this.loadMore();
                        }
                    }}
                    ref={(el) => {
                        this.containerRef = el;
                    }}
                >
                    {this.getLoadedItemsCount() === 0 ? null : this.props.children(items)}
                    {(() => {
                        if (loading === true) {
                            return (
                                <div
                                    style={{
                                        ...messageStyles,
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        width: '100%',
                                    }}
                                >
                                    {gettext('Loading...')}
                                </div>
                            );
                        } else if (this.allItemsLoaded()) {
                            if (this.getLoadedItemsCount() === 0) {
                                return (
                                    <div style={messageStyles}>{gettext('There are currently no items.')}</div>
                                );
                            } else {
                                return (
                                    <div style={messageStyles}>{gettext('All items have been loaded.')}</div>
                                );
                            }
                        } else {
                            return null;
                        }
                    })()}
                </div>
            </div>
        );
    }
}
