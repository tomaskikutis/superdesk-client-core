import React from "react";
import {
    SidePanelTools,
    SidePanel,
    SidePanelHeader,
    SidePanelHeading,
    SidePanelContent,
    SidePanelContentBlock,
} from "core/components/SidePanel";
import {FormViewEdit} from "./generic-form/from-group";
import {IFormGroup} from "./generic-form/interfaces/form";
import { connectServices } from "core/helpers/ReactRenderAsync";

interface IProps {
    operation: 'editing' | 'creation';
    formConfig: IFormGroup;
    item: {[key: string]: any};
    onClose: () => void;
    onCancel?: () => void;
    onSave: (nextItem) => Promise<any>;
    onEditModeChange?(currentEditMode: boolean): void;

    // connected services
    modal?: any;
}

interface IState {
    editMode: boolean;
    nextItem: IProps['item'];
}

class KnowledgeItemViewEditComponent extends React.Component<IProps, IState> {
    constructor(props) {
        super(props);

        this.state = {
            editMode: this.props.operation === 'creation' ? true : false,
            nextItem: this.props.item,
        };

        this.enableEditMode = this.enableEditMode.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleFieldChange = this.handleFieldChange.bind(this);
        this.isFormDirty = this.isFormDirty.bind(this);
    }
    componentWillReceiveProps(nextProps) {
        if (this.state.editMode === false) {
            // enable changing which item is previewed
            this.setState({
                nextItem: nextProps.item,
            });
        }
    }
    componentDidUpdate(prevProps, prevState) {
        if (this.state.editMode !== prevState.editMode && typeof this.props.onEditModeChange === 'function') {
            this.props.onEditModeChange(this.state.editMode);
        }
    }
    componentDidMount() {
        if (typeof this.props.onEditModeChange === 'function') {
            this.props.onEditModeChange(this.state.editMode);
        }
    }
    componentWillUnmount() {
        if (typeof this.props.onEditModeChange === 'function') {
            this.props.onEditModeChange(false);
        }
    }
    enableEditMode() {
        this.setState({
            editMode: true,
            nextItem: this.props.item,
        });
    }
    handleFieldChange(field: keyof IProps['item'], nextValue: valueof<IProps['item']>) {
        this.setState({
            ...this.state,
            nextItem: {
                ...this.state.nextItem,
                [field]: nextValue,
            },
        });
    }
    handleCancel() {
        const cancelFn = typeof this.props.onCancel === 'function'
            ? this.props.onCancel
            : () => {
                this.setState({
                    editMode: false,
                    nextItem: this.props.item,
                });
            };

        (
            this.isFormDirty() === false
            ? Promise.resolve()
            : this.props.modal.confirm(gettext('There are unsaved changes which will be discarded. Continue?'))
        ).then(cancelFn)
        .catch(() => {
            // do nothing
        });
    }
    isFormDirty() {
        return JSON.stringify(this.props.item) !== JSON.stringify(this.state.nextItem);
    }
    render() {
        return (
            <SidePanel side='right' width={360}>
                <SidePanelHeader>
                    <SidePanelHeading>{gettext('Details:')}</SidePanelHeading>
                    {
                        this.state.editMode
                            ? (
                                <div className="side-panel__sliding-toolbar side-panel__sliding-toolbar--right">
                                    <button className="btn" onClick={this.handleCancel}>
                                        {gettext('Cancel')}
                                    </button>
                                    <button
                                        disabled={!this.isFormDirty()}
                                        onClick={() => {
                                            this.props.onSave(this.state.nextItem).then(() => {
                                                this.setState({editMode: false});
                                            });
                                        }}
                                        className="btn btn--primary"
                                    >
                                        {gettext('Save')}
                                    </button>
                                </div>
                            )
                            : (
                                <SidePanelTools>
                                    <div>
                                        {
                                            this.props.operation === 'editing' ? (
                                                <button onClick={this.enableEditMode} className="icn-btn">
                                                    <i className="icon-pencil"></i>
                                                </button>
                                            ) : null
                                        }
                                        <button className="icn-btn" onClick={this.props.onClose}>
                                            <i className="icon-close-small"></i>
                                        </button>
                                    </div>
                                </SidePanelTools>
                            )
                    }
                </SidePanelHeader>
                <SidePanelContent>
                    <SidePanelContentBlock>
                        <FormViewEdit
                            item={this.state.nextItem}
                            formConfig={this.props.formConfig}
                            editMode={this.state.editMode}
                            handleFieldChange={this.handleFieldChange}
                        />
                    </SidePanelContentBlock>
                </SidePanelContent>
            </SidePanel>
        );
    }
}

export const KnowledgeItemViewEdit = connectServices<IProps>(
    KnowledgeItemViewEditComponent,
    ['modal'],
);
