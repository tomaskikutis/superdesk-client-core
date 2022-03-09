/* eslint-disable react/no-multi-comp */

import React from 'react';
import { IAuthoringSideWidget, IExtensionActivationResult, IUser } from 'superdesk-api';
import { httpRequestJsonLocal } from 'core/helpers/network';
import { gettext } from 'core/utils';
import { AuthoringWidgetHeading } from 'apps/dashboard/widget-heading';
import { AuthoringWidgetLayout } from 'apps/dashboard/widget-layout';
import { Button, EmptyState, Checkbox, ButtonGroup, BoxedList, BoxedListItem, BoxedListContentRow } from 'superdesk-ui-framework/react';
import { store } from 'core/data';
import { UserAvatar } from 'apps/users/components/UserAvatar';
import { RelativeDate } from 'core/datetime/relativeDate';
import { Spacer } from 'core/ui/components/Spacer';
import { UserPopup } from 'core/ui/components';
import { MentionsInput, Mention } from 'react-mentions';
import mentionsStyle from './mention.Style';


const ENTER = 13;

// Can't call `gettext` in the top level
const getLabel = () => gettext('Comments');

type IProps = React.ComponentProps<
  IExtensionActivationResult['contributions']['authoringSideWidgets'][0]['component']
>;

type TComment = {
  _id: string;
  text: string;
  item: string;
  user?: IUser;
  mentioned_users?: any;
  mentioned_desks?: any;
  _updated?: string;
  _created: string;
}
class Comment extends React.PureComponent<{ comment: TComment, users: { [key: string]: IUser } }> {

  getMessageText = () => {
    const { comment } = this.props;

    let commentText = comment.text;

    if (Object.keys(comment.mentioned_users).length || Object.keys(comment.mentioned_desks).length) {
      const mentions: Array<{ name: string; index: number; id: string; type: string; }> = [];

      // desks
      if (Object.keys(comment.mentioned_desks).length) {
        for (const mention in comment.mentioned_desks) {
          const mentionText = "#" + mention.replace(" ", "_");
          const index = commentText.indexOf(mentionText);

          mentions.push({
            name: mention,
            index: index,
            id: comment.mentioned_desks[mention],
            type: "desk"
          })
        }
      }

      // users
      if (Object.keys(comment.mentioned_users).length) {
        for (const mention in comment.mentioned_users) {
          const mentionText = "@" + mention;
          const index = commentText.indexOf(mentionText);

          mentions.push({
            name: mention,
            index: index,
            id: comment.mentioned_users[mention],
            type: "user"
          })
        }
      }

      if (mentions.length) {
        const result: Array<JSX.Element> = [];
        let indexFrom: number = 0;

        mentions.sort((a, b) => a.index > b.index ? 1 : -1);

        mentions.forEach(mention => {
          let mentionText: string = mention.type === "user" ? "@" : "#";
          mentionText += mention.name.replace(" ", "_");
          const indexTo: number = commentText.indexOf(mentionText);

          result.push(<span key={"text" + indexFrom}>{commentText.slice(indexFrom, indexTo)}&nbsp;</span>);

          if (mention.type === "user") {
            result.push(
              <UserPopup key={"mentionuser" + indexFrom} mentionName={mentionText} user={this.props.users[mention.id]} />
            );
          } else {
            result.push(
              <a key={"mentiondesk" + indexFrom}>{mentionText}</a>
            );
          }

          indexFrom = indexTo + mentionText.length;
        });

        result.push(<span key={"endOfMessage"}>&nbsp;{commentText.slice(indexFrom)}</span>);

        return result;
      }
    }

    return commentText;

  }


  render() {
    const { comment } = this.props;

    return (
      <BoxedListItem
        media={!!comment.user ? (
          <UserAvatar user={comment.user} />
        ) : null}
      >
        <BoxedListContentRow>
          <RelativeDate datetime={comment._updated ? comment._updated : comment._created} />
        </BoxedListContentRow>
        {!!comment.user && <BoxedListContentRow><h4 className="sd-heading sd-text--sans sd-heading--h4">{comment.user.display_name}</h4></BoxedListContentRow>}
        <BoxedListContentRow>
          <p>{this.getMessageText()}</p>
        </BoxedListContentRow>
      </BoxedListItem>
    );
  }
}


interface IState {
  itemId: string | null;
  comments: TComment[] | null;
  commentMessage: string;
  saveOnEnter: boolean;
  users: { [key: string]: IUser };
  mentionInputDataUsers: Array<{ id: string, display: string }>
  mentionInputDataDesks: Array<{ id: string, display: string }>
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
      mentionInputDataDesks: []
    };

    this.reload();
    this.loadUsers();
    this.loadDesks();
  }

  loadDesks = () => {
    httpRequestJsonLocal({
      method: 'GET',
      path: `/desks`
    }).then((response: any) => {
      const desks = response._items.map(desk => { return { id: desk.name.replace(" ", "_"), display: desk.name, type: 'desk' } });
      this.setState({ mentionInputDataDesks: desks });
    })
  }

  loadUsers = async () => {
    const users = await store.getState().users.entities;
    const mentionInputDataUsers = [];

    for (const key in users) {
      mentionInputDataUsers.push({ id: users[key].username, display: users[key].display_name, type: 'user', user: users[key] })
    }

    this.setState({ users: users, mentionInputDataUsers: mentionInputDataUsers })
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
        path: `/item_comments`,
        urlParams: criteria,
      }).then((response: any) => {
        this.setState({ comments: response?._items || null })
      })
    }
  }

  save = () => {
    if (!this.state.commentMessage.length) {
      return;
    }

    const userRegex = /\'@\[[a-zA-Z0-1-_\s]*\]\(user\:([a-zA-Z0-1-_]*)\)\'/gm;
    const deskRegex = /\'@\[[a-zA-Z0-1-_\s]*\]\(desk\:([a-zA-Z0-1-_]*)\)\'/gm;
    let commentMessage = this.state.commentMessage;

    console.log(commentMessage)
    commentMessage = commentMessage.replace(userRegex, "@$1");
    console.log(commentMessage)
    commentMessage = commentMessage.replace(deskRegex, "#$1");
    console.log(commentMessage)

    const comment = {
      item: this.state.itemId,
      text: commentMessage
    };

    httpRequestJsonLocal({
      method: 'POST',
      path: `/item_comments`,
      payload: comment,
    }).then((response: any) => {
      this.setState({ commentMessage: '' });
      this.reload();
    })

  }

  handleCommentInputKeyDown = (event) => {
    if (!this.state.saveOnEnter || event.keyCode !== ENTER || event.shiftKey) {
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
            this.state.comments.map((comment, i) => <Comment key={i} comment={comment} users={this.state.users} />)
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
          onChange={(ev, newValue) => { this.setState({ commentMessage: newValue }) }}
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
          <Checkbox checked={this.state.saveOnEnter} label={{ text: 'post on "Enter"' }}
            onChange={(value) => { this.setState({ saveOnEnter: value }) }} />
          <ButtonGroup align='end'>
            <Button text='cancel' onClick={() => { this.setState({ commentMessage: '' }) }} />
            <Button text='post' type="primary" onClick={this.save} disabled={!this.state.commentMessage.length} />
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

export function getCommentsWidget() {
  const metadataWidget: IAuthoringSideWidget = {
    _id: 'comments-widget',
    label: getLabel(),
    order: 2,
    icon: 'chat',
    component: CommentsWidget,
    isAllowed: (item) => item._type !== 'legal_archive',
  };

  return metadataWidget;
}


