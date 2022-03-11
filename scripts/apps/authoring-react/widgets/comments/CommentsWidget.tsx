import React from 'react';
import { IExtensionActivationResult, IUser, IArticle } from 'superdesk-api';
import { httpRequestJsonLocal } from 'core/helpers/network';
import { gettext } from 'core/utils';
import { AuthoringWidgetHeading } from 'apps/dashboard/widget-heading';
import { AuthoringWidgetLayout } from 'apps/dashboard/widget-layout';
import {
    Button,
    EmptyState,
    Checkbox,
    ButtonGroup,
    BoxedList,
} from 'superdesk-ui-framework/react';
import { store } from 'core/data';
import { UserAvatar } from 'apps/users/components/UserAvatar';
import { Spacer } from 'core/ui/components/Spacer';
import { MentionsInput, Mention } from 'react-mentions';
import mentionsStyle from './mention.style';
import { Comment, TComment } from "./Comment";

// Can't call `gettext` in the top level
const getLabel = () => gettext('Comments');

type IProps = React.ComponentProps<
    IExtensionActivationResult['contributions']['authoringSideWidgets'][0]['component']
>;
interface IState {
    itemId: IArticle['_id'] | null;
    comments: Array<TComment> | null;
    commentMessage: string;
    saveOnEnter: boolean;
    users: { [key: string]: IUser };
    mentionInputDataUsers: Array<{ id: string, display: string }>;
    mentionInputDataDesks: Array<{ id: string, display: string }>;
}

class CommentsWidget extends React.PureComponent<IProps, IState> {
    constructor(props: IProps) {
        super(props);

        this.state = {
            itemId: props.article?._id || null,
            comments: null,
            commentMessage: '',
            saveOnEnter: false,
            users: {},
            mentionInputDataUsers: [],
            mentionInputDataDesks: [],
        };
    }

    componentDidMount(): void {
        this.reload();
        this.loadData();
    }

    loadData = () => {
        Promise.all([this.loadDesks(), this.loadUsers()])
            .then((values: any) => {
                this.setState({
                    mentionInputDataDesks: values[0].desks,
                    users: values[1].users,
                    mentionInputDataUsers: values[1].mentionInputDataUsers,
                });
            });
    }

    loadDesks = () => {
        return new Promise((resolve) => {
            httpRequestJsonLocal({
                method: 'GET',
                path: '/desks',
            }).then((response: any) => {
                const desks = response._items.map(
                    (desk) => {
                        return { id: desk.name.replace(/\s/gm, '_'), display: desk.name, type: 'desk' };
                    },
                );

                resolve({ desks: desks });
            });
        });
    }

    loadUsers = () => {
        return new Promise((resolve) => {
            const users = store.getState().users.entities;
            const mentionInputDataUsers = [];

            for (const key in users) {
                mentionInputDataUsers.push(
                    { id: users[key].username, display: users[key].display_name, type: 'user', user: users[key] },
                );
            }
            resolve({ users: users, mentionInputDataUsers: mentionInputDataUsers });
        });
    }

    reload = () => {
        if (this.state.itemId) {
            const criteria = {
                where: {
                    item: this.state.itemId,
                },
                embedded: { user: 1 },
            };

            httpRequestJsonLocal({
                method: 'GET',
                path: '/item_comments',
                urlParams: criteria,
            }).then((response: any) => {
                this.setState({ comments: response?._items || null });
            });
        }
    }

    save = () => {
        if (!this.state.commentMessage.length) {
            return;
        }

        const userRegex = /'@\[[^\]\[]*\]\(user\:([^\)\(]*)\)\'/gm;
        const deskRegex = /'@\[[^\]\[]*\]\(desk\:([^\)\(]*)\)\'/gm;
        let commentMessage = this.state.commentMessage;

        commentMessage = commentMessage.replace(userRegex, '@$1');
        commentMessage = commentMessage.replace(deskRegex, '#$1');

        const comment = {
            item: this.state.itemId,
            text: commentMessage,
        };

        httpRequestJsonLocal({
            method: 'POST',
            path: '/item_comments',
            payload: comment,
        }).then((response: any) => {
            this.setState({ commentMessage: '' });
            this.reload();
        });
    }

    handleCommentInputKeyDown = (event) => {
        if (!this.state.saveOnEnter || event.key !== 'Enter' || event.shiftKey) {
            return;
        }
        this.save();
    }

    renderSuggestion = (item, search, highlightedDisplay) => {
        return (
            <>
                {item.type === 'desk'
                    ? <i className="icon-tasks" />
                    : <UserAvatar user={item.user} size="small" />
                }
                <span style={{ marginLeft: '1em' }}>{highlightedDisplay}</span>
            </>
        );
    }

    render() {
        const hasComments = !!this.state.comments?.length;

        const widgetBody: JSX.Element = hasComments
            ? (
                <BoxedList>
                    {
                        this.state.comments.map((comment, i) =>
                            (<Comment key={i} comment={comment} users={this.state.users} />),
                        )
                    }
                </BoxedList>
            )
            : (
                <EmptyState
                    title={gettext('No comments have been posted')}
                    illustration="3"
                />
            );

        const widgetFooter: JSX.Element = this.state.itemId ? (
            <Spacer v gap="8" >
                <MentionsInput
                    value={this.state.commentMessage}
                    onChange={(ev, newValue) => {
                        this.setState({ commentMessage: newValue });
                    }}
                    style={mentionsStyle.input}
                    markup="'@[__display__](__type__:__id__)'"
                    placeholder={gettext('Type your comment...')}
                    onKeyDown={this.handleCommentInputKeyDown}
                >
                    <Mention
                        data={this.state.mentionInputDataUsers}
                        trigger="@"
                        type="user"
                        style={mentionsStyle.mention}
                        appendSpaceOnAdd
                        renderSuggestion={this.renderSuggestion}
                    />

                    <Mention
                        data={this.state.mentionInputDataDesks}
                        trigger="#"
                        type="desk"
                        style={mentionsStyle.mention}
                        appendSpaceOnAdd
                        renderSuggestion={this.renderSuggestion}
                    />
                </MentionsInput>

                <Spacer h gap="4" justifyContent="stretch">
                    <Checkbox
                        checked={this.state.saveOnEnter}
                        label={{ text: 'post on "Enter"' }}
                        onChange={(value) => {
                            this.setState({ saveOnEnter: value });
                        }}
                    />
                    <ButtonGroup align="end">
                        <Button
                            text="cancel"
                            onClick={() => {
                                this.setState({ commentMessage: '' });
                            }}
                        />
                        <Button
                            text="post"
                            type="primary"
                            onClick={this.save}
                            disabled={!this.state.commentMessage.length}
                        />
                    </ButtonGroup>
                </Spacer>
            </Spacer>
        ) : null;

        return (
            <AuthoringWidgetLayout
                header={(
                    <AuthoringWidgetHeading
                        widgetName={getLabel()}
                        editMode={false}
                    />
                )}
                body={widgetBody}
                background="grey"
                footer={widgetFooter}
            />
        );
    }
}

export default CommentsWidget;
