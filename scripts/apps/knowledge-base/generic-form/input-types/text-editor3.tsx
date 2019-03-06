import React from "react";
import classNames from 'classnames';
import {IInputType} from "../interfaces/input-types";
import {RawDraftContentState, convertFromRaw, ContentState, convertToRaw} from "draft-js";
import {Editor3Standalone} from "core/editor3/react";
import {HTMLGenerator} from "core/editor3/html/to-html/HTMLGenerator";
import {UserHtmlSingleLine} from "core/helpers/UserHtmlSingleLine";
import {getContentStateFromHtml} from "core/editor3/html/from-html";

type IProps =  IInputType<string>;

interface IState {
    rawDraftContentState: RawDraftContentState;
}

function getRawDraftContentStateFromString(input?: string): RawDraftContentState {
    return typeof input === 'string' && input.trim().length > 0
        ? convertToRaw(getContentStateFromHtml(input))
        : convertToRaw(ContentState.createFromText(''));
}

export class TextEditor3 extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            rawDraftContentState: getRawDraftContentStateFromString(this.props.value),
        };

        this.handleChange = this.handleChange.bind(this);
    }
    handleChange(rawDraftContentState: RawDraftContentState): void {
        this.setState({rawDraftContentState});
        this.props.onChange(new HTMLGenerator(convertFromRaw(rawDraftContentState)).html());
    }
    componentDidUpdate() {
        if (this.props.value !== new HTMLGenerator(convertFromRaw(this.state.rawDraftContentState)).html()) {
            // This component holds it's own state which is derived from props
            // internal state is reloaded when it doesn't match with what's in the props
            // holding own state is required to prevent infinite loops which would happen because
            // draftjs keys change every time content state is created from HTML
            this.setState({rawDraftContentState: getRawDraftContentStateFromString(this.props.value)});
        }
    }
    render() {
        if (this.props.previewOuput) {
            return <UserHtmlSingleLine html={this.props.value} />;
        }

        return (
            <div className={classNames('sd-line-input', {'sd-line-input--invalid': this.props.issues.length > 0})}>
                <label className="sd-line-input__label">{this.props.formField.label}</label>
                <Editor3Standalone
                    scrollContainer={'window'}
                    onChange={this.handleChange}
                    editorFormat={['bold', 'italic', 'underline', 'link']}
                    rawDraftContentState={this.state.rawDraftContentState}
                    disableSpellchecker={true}
                    readOnly={this.props.disabled}
                />
                {
                    this.props.issues.map((str, i) => (
                        <div key={i} className="sd-line-input__message">{str}</div>
                    ))
                }
            </div>
        );
    }
}
