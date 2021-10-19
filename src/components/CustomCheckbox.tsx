import { css, Theme } from "@emotion/react";

export interface CustomCheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

const CustomCheckbox: React.VFC<CustomCheckboxProps> = (props) => {
  const { label, disabled, ...rest } = props;
  return (
    <label className={disabled ? "disabled" : ""} css={styles}>
      <div className="checkbox-input">
        <input type="checkbox" {...{ disabled, ...rest }} />
        <span className="checkbox-control" aria-hidden="true">
          <span className="checked-indicator" />
        </span>
      </div>
      {label}
    </label>
  );
};
export default CustomCheckbox;

const styles = (theme: Theme) => css`
  display: inline-grid;
  grid-auto-flow: column;
  column-gap: 10px;
  align-items: center;

  &.disabled {
    opacity: 0.3;
  }

  .checkbox-input {
    display: grid;
    grid-template-columns: 20px;
    grid-template-rows: 20px;
    align-items: center;
    justify-items: center;

    & > input {
      opacity: 0;
      width: 20px;
      height: 20px;
    }

    & > * {
      grid-row: 1;
      grid-column: 1;
    }

    .checkbox-control {
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid ${theme.palette.white};
      border-radius: ${theme.spacing(0.5)};

      .checked-indicator {
        display: none;
        width: 14px;
        height: 14px;
        background-color: ${theme.palette.blue};
      }
    }

    input:checked + .checkbox-control {
      border-color: ${theme.palette.blue};

      .checked-indicator {
        display: block;
      }
    }

    input:focus + .checkbox-control {
      box-shadow: 0 0 0 0.05em #fff, 0 0 0.15em 0.1em ${theme.palette.blue};
    }
  }
`;
