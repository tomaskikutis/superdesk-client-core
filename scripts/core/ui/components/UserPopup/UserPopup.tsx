import React from 'react';
import {showPopup} from 'core/ui/components/popupNew';
import {IUser} from 'superdesk-api';
import {UserAvatar} from 'apps/users/components/UserAvatar';

interface IProps {
  user: IUser;
  mentionName: string;
}

const UserPopup = ({mentionName, user}: IProps) => {
    const renderPopup = (referenceElement: HTMLElement) => {
        showPopup(
            referenceElement,
            'left-end',
            ({closePopup}) => (
                <div className="user-popup" onMouseLeave={closePopup} style={{display: 'block'}}>
                    <div style={{paddingTop: '20px', display: 'flex', justifyContent: 'center'}}>
                        <UserAvatar user={user} size="large" />
                    </div>
                    <div className="title">{user.display_name}</div>
                    <div className="actions">
                        <a href={'#/users/' + user._id}>go to profile</a>
                    </div>
                </div>
            ),
        );
    };

    return (
        <a
            onMouseEnter={(event) => {
                renderPopup(event.target as HTMLElement);
            }}
        >
            {mentionName}
        </a>
    );
};

export default UserPopup;
