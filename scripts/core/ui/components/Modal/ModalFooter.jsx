import React from 'react';
import PropTypes from 'prop-types';

export const ModalFooter = (props) => (
    <div className="modal__footer">
        {props.children}
    </div>
);

ModalFooter.propTypes = {
    children: PropTypes.any.isRequired,
};