/* eslint-disable react/no-multi-comp */

import React from 'react';
import { IAuthoringSideWidget, IExtensionActivationResult, IUser } from 'superdesk-api';
import { sdApi } from 'api';
import { httpRequestJsonLocal } from 'core/helpers/network';
import { gettext } from 'core/utils';
import { AuthoringWidgetHeading } from 'apps/dashboard/widget-heading';
import { AuthoringWidgetLayout } from 'apps/dashboard/widget-layout';
import { Button, EmptyState, Checkbox, ButtonGroup } from 'superdesk-ui-framework/react';
import { IEditor3Value } from '../manage-editor3-inside-authoring-react';
import { getCustomEditor3Data, getCustomMetadataFromContentState } from 'core/editor3/helpers/editor3CustomData';
import { getHighlightsConfig } from 'core/editor3/highlightsConfig';
import { store } from 'core/data';
import { Card } from 'core/ui/components/Card';
import { UserAvatar } from 'apps/users/components/UserAvatar';
import { RelativeDate } from 'core/datetime/relativeDate';
import { assertNever } from 'core/helpers/typescript-helpers';
import { Spacer, SpacerInline } from 'core/ui/components/Spacer';

const ENTER = 13;

// Can't call `gettext` in the top level
const getLabel = () => gettext('Comments');

type IProps = React.ComponentProps<
  IExtensionActivationResult['contributions']['authoringSideWidgets'][0]['component']
>;

interface IComment {
  _id: string;
  text: string;
  item: string;
  user?: IUser;
  mentioned_users?: any;
  mentioned_desks?: any;
  _updated?: string;
  _created: string;
}

interface IState {
  itemId: string | null;
  comments: IComment[] | null;
  commentMessage: string;
  saveOnEnter: boolean;
}

class Comment extends React.PureComponent<{ comment: IComment }> {

  getMessageText = () => {
    const { comment } = this.props;

    let text = comment.text.replace(/(?:\r\n|\r|\n)/g, '</p><p>');

    // map user mentions
    // eslint-disable-next-line no-useless-escape
    const mentionedUsers = text.match(/\@([a-zA-Z0-9-_.\w]+)/g);
    if (mentionedUsers?.length) {
      mentionedUsers.forEach((token) => {
        const username = token.substring(1, token.length);

        if (comment.mentioned_users && comment.mentioned_users[username]) {
          text = text.replace(token,
            '<i sd-user-info data-user="' + comment.mentioned_users[username] + '">' + token + '</i>',
          );
        }
      });
    }
    // map desk mentions
    // eslint-disable-next-line no-useless-escape
    const mentionedDesks = text.match(/\#([a-zA-Z0-9-_.]\w+)/g);
    if (mentionedDesks?.length) {
      mentionedDesks.forEach((token) => {
        const deskname = token.substring(1, token.length);

        if (comment.mentioned_desks && comment.mentioned_desks[deskname]) {
          text = text.replace(token,
            '<a href="">' + token + '</a>');
        }
      });
    }

    return <>{text}</>
  }


  render() {
    const { comment } = this.props;

    return (
      <Card>
        <Spacer h gap="16" justifyContent="start" alignItems="start" noGrow>
          {!!comment.user && <UserAvatar user={comment.user} />}
          <Spacer v gap="8">
            <RelativeDate datetime={comment._updated ? comment._updated : comment._created} />
            <div>
              {!!comment.user && <strong>{comment.user.display_name + ": "}</strong>}
              {this.getMessageText()}
            </div>
          </Spacer>
        </Spacer>
      </Card>
    );
  }
}

class CommentsWidget extends React.PureComponent<IProps, IState> {
  constructor(props: IProps) {
    super(props);

    this.state = {
      itemId: props.article?._id || null,
      comments: null,
      commentMessage: '',
      saveOnEnter: false
    };

    this.reload();
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

    const comment = {
      item: this.state.itemId,
      text: this.state.commentMessage
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

  handleCommentInputKeyUp = (event) => {
    if (!this.state.saveOnEnter || event.keyCode !== ENTER || event.shiftKey) {
      return;
    }
    this.save();
  }



  render() {
    const hasComments = !!this.state.comments?.length;

    const widgetBody: JSX.Element = hasComments
      ? (
        <Spacer v gap="16">
          {
            this.state.comments.map((comment, i) => <Comment key={i} comment={comment} />)
          }
        </Spacer>
      )
      : (
        <EmptyState
          title={gettext('No comments have been posted')}
          illustration="3"
        />
      );


    const widgetFooter: JSX.Element = this.state.itemId ? (

      <Spacer v gap="8" >
        <textarea className="new-comment" onKeyUp={this.handleCommentInputKeyUp} value={this.state.commentMessage} onChange={(event) => { this.setState({ commentMessage: event.target.value }) }}></textarea>


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
