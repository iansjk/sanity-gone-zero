import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Button,
  css,
  GlobalStyles,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  styled,
  Theme,
  useTheme,
} from "@mui/material";
import slugify from "@sindresorhus/slugify";
import { MdArrowForwardIos } from "react-icons/md";

import Layout from "../../Layout";
import {
  classToProfession,
  subclassToSubProfessionId,
  professionToClass,
  subProfessionIdToSubclass,
  toTitleCase,
} from "../../utils/globals";
import CustomCheckbox from "../../components/CustomCheckbox";
import FilterIcon from "../../components/icons/FilterIcon";
import HorizontalScroller from "../../components/HorizontalScroller";
import TraitInfo from "../../components/TraitInfo";
import OperatorList, {
  OperatorListOperator,
} from "../../components/OperatorList";

import { Media } from "../../Media";
import { fetchContentfulGraphQl } from "../../utils/fetch";
import Image from "next/image";
import { GetStaticProps } from "next";
import { DenormalizedCharacter } from "../../../scripts/types";
import operatorListBannerImage from "../../images/page-banners/operators.jpg";
import { operatorClassIcon, operatorBranchIcon } from "../../utils/images";
import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote";
import { serialize } from "next-mdx-remote/serialize";
import * as classes from "./index.css";

const MENU_ICON_SIZE = 18;

const ClassSubclassMenuItem = styled(MenuItem)(({ theme }) => ({
  padding: theme.spacing(0, 1.5),
  minHeight: "unset",
  "&.selected": {
    backgroundColor: theme.palette.midtoneBrighterer.main,
  },
  "& .MuiListItemIcon-root": {
    minWidth: "unset",
    marginRight: theme.spacing(1),
  },
  "& .MuiListItemText-root": {
    padding: theme.spacing(1, 0),
  },
}));

interface Props {
  allOperators: OperatorListOperator[];
  classes: {
    [profession: string]: {
      className: string;
      profession: string;
      analysis: MDXRemoteSerializeResult;
    };
  };
  branches: {
    [subProfessionId: string]: {
      subProfessionId: string;
      analysis: MDXRemoteSerializeResult | null;
      class: {
        profession: string;
      };
    };
  };
  operatorsWithGuides: { [operatorName: string]: string }; // operator name -> slug
}

export const getStaticProps: GetStaticProps = async () => {
  const { default: operatorsJson } = await import(
    "../../../data/operators.json"
  );
  const { default: branchesJson } = await import("../../../data/branches.json");
  const allOperators = Object.values(operatorsJson).map((operator) => {
    const { charId, name, isCnOnly, profession, subProfessionId, rarity } =
      operator as DenormalizedCharacter;
    return {
      charId,
      name,
      isCnOnly,
      profession,
      subProfessionId,
      rarity,
    };
  });

  const query = `
    query {
      operatorClassCollection {
        items {
          className
          profession
          analysis
        }
      }
      operatorSubclassCollection {
        items {
          subProfessionId
          analysis
          class {
            profession
          }
        }
      }
      operatorAnalysisCollection {
        items {
          operator {
            slug
            name
            sys {
              publishedAt
            }
          }
        }
      }
    }
  `;
  const {
    operatorClassCollection,
    operatorSubclassCollection,
    operatorAnalysisCollection,
  } = await fetchContentfulGraphQl<{
    operatorClassCollection: {
      items: {
        className: string;
        profession: string;
        analysis: string;
      }[];
    };
    operatorSubclassCollection: {
      items: {
        subProfessionId: string;
        analysis: string;
        class: {
          profession: string;
        };
      }[];
    };
    operatorAnalysisCollection: {
      items: {
        operator: {
          slug: string;
          name: string;
          sys: {
            publishedAt: string;
          };
        };
      }[];
    };
  }>(query);

  const contentfulBranchEntries = Object.fromEntries(
    operatorSubclassCollection.items.map((entry) => [
      entry.subProfessionId,
      entry,
    ])
  );
  const branchesWithAnalyses = await Promise.all(
    Object.entries(branchesJson).map(
      async ([subProfessionId, { class: className }]) => {
        const contentfulEntry = contentfulBranchEntries[subProfessionId];
        return {
          subProfessionId,
          class: contentfulEntry?.class ?? {
            profession: classToProfession(className),
          },
          analysis:
            contentfulEntry?.analysis != null
              ? await serialize(contentfulEntry.analysis)
              : null,
        };
      }
    )
  );

  const classesWithAnalyses = await Promise.all(
    operatorClassCollection.items.map(async (item) => ({
      ...item,
      analysis: await serialize(item.analysis),
    }))
  );
  const operatorsWithGuides = Object.fromEntries(
    operatorAnalysisCollection.items.map((item) => [
      item.operator.name,
      item.operator.slug,
    ])
  );
  const props: Props = {
    allOperators,
    classes: Object.fromEntries(
      classesWithAnalyses.map((akClass) => [akClass.profession, akClass])
    ),
    branches: Object.fromEntries(
      branchesWithAnalyses.map((branch) => [branch.subProfessionId, branch])
    ),
    operatorsWithGuides,
  };
  return { props };
};

const Operators: React.VFC<Props> = (props) => {
  const {
    allOperators,
    classes: opClasses,
    branches,
    operatorsWithGuides,
  } = props;

  const [showOnlyGuideAvailable, setShowOnlyGuideAvailable] = useState(true);
  const [showClassDescriptions, setShowClassDescriptions] = useState(true);
  const [isClassMenuOpen, setIsClassMenuOpen] = useState(false);
  const [isSubclassMenuOpen, setIsSubclassMenuOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProfession, setSelectedProfession] = useState<string | null>(
    null
  );
  const [selectedSubProfessionId, setSelectedSubProfessionId] = useState<
    string | null
  >(null);
  const theme = useTheme();

  const hashChangeCallback = useCallback(() => {
    const hash = window.location.hash;
    if (hash.length > 0) {
      console.log(hash);
      const classMatch = /^#([^-]*?)(?:-(.*?))?$/.exec(hash);
      const opClass = classMatch ? classMatch[1] : "";
      const opSubclass = classMatch
        ? classMatch[2]
          ? classMatch[2]
              .split("_")
              .map((word) => toTitleCase(word))
              .join(" ")
          : ""
        : ""; // yes i nested 2 ternary statements, cry about it
      setSelectedProfession(classToProfession(toTitleCase(opClass)));
      setSelectedSubProfessionId(subclassToSubProfessionId(opSubclass));
    }
  }, []);

  useEffect(() => {
    window.addEventListener("hashchange", hashChangeCallback);
    hashChangeCallback(); // run once on mount
    return () => window.removeEventListener("hashchange", hashChangeCallback);
  }, [hashChangeCallback]);

  const handleGuideAvailableChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setShowOnlyGuideAvailable(e.target.checked);
  };

  const handleClassMenuClick: React.MouseEventHandler<HTMLButtonElement> = (
    e
  ) => {
    setAnchorEl(e.currentTarget);
    setIsClassMenuOpen(true);
  };

  const handleSubclassMenuClick: React.MouseEventHandler<HTMLButtonElement> = (
    e
  ) => {
    setAnchorEl(e.currentTarget);
    setIsSubclassMenuOpen(true);
  };

  const handleClassClick = (profession: string | null) => () => {
    setSelectedProfession((oldProfession) => {
      if (oldProfession !== profession) {
        setSelectedSubProfessionId(null);
      }
      return profession;
    });
    setIsClassMenuOpen(false);
  };

  const handleSubclassClick = (subProfessionId: string | null) => () => {
    setSelectedSubProfessionId(subProfessionId);
    setIsSubclassMenuOpen(false);
  };

  const handleSubclassFilter = useCallback(
    (profession: string, subProfessionId: string) => {
      setSelectedProfession(profession);
      setSelectedSubProfessionId(subProfessionId);
    },
    []
  );

  const handleResetFilter = () => {
    setSelectedProfession(null);
    setSelectedSubProfessionId(null);
  };

  const selectedClass =
    selectedProfession != null ? professionToClass(selectedProfession) : null;
  const selectedSubclass =
    selectedSubProfessionId != null
      ? subProfessionIdToSubclass(selectedSubProfessionId)
      : null;

  const filterSettings = useMemo(
    () => ({
      showOnlyGuideAvailable,
      selectedProfession,
      selectedSubProfessionId,
    }),
    [selectedProfession, selectedSubProfessionId, showOnlyGuideAvailable]
  );

  const sortAndFilterOptions = (
    <>
      <span className={classes.filterVisualLabel} aria-hidden="true">
        <FilterIcon />
        Filters
      </span>
      <Button
        id="class-menu-button"
        variant="contained"
        aria-label="Select class"
        aria-controls="class-menu"
        aria-haspopup="true"
        aria-expanded={isClassMenuOpen ? "true" : undefined}
        onClick={handleClassMenuClick}
        className={classes.sortAndFilterButton}
      >
        {selectedProfession ? (
          <>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
              src={operatorClassIcon(slugify(selectedClass!))}
              alt=""
              width={MENU_ICON_SIZE}
              height={MENU_ICON_SIZE}
            />
            {selectedClass}
          </>
        ) : (
          "All Classes"
        )}
      </Button>
      <Menu
        id="class-menu"
        open={isClassMenuOpen}
        anchorEl={anchorEl}
        MenuListProps={{
          "aria-labelledby": "class-menu-button",
        }}
        onClose={() => setIsClassMenuOpen(false)}
      >
        <ClassSubclassMenuItem
          onClick={handleClassClick(null)}
          className={selectedProfession == null ? "selected" : ""}
        >
          <ListItemText>All Classes</ListItemText>
        </ClassSubclassMenuItem>
        {Object.values(opClasses).map(({ className, profession }) => (
          <ClassSubclassMenuItem
            key={className}
            onClick={handleClassClick(profession)}
            className={selectedProfession === profession ? "selected" : ""}
          >
            <ListItemIcon>
              <Image
                src={operatorClassIcon(slugify(className))}
                alt=""
                width={MENU_ICON_SIZE}
                height={MENU_ICON_SIZE}
              />
            </ListItemIcon>
            <ListItemText>{className}</ListItemText>
          </ClassSubclassMenuItem>
        ))}
      </Menu>
      <Button
        id="subclass-menu-button"
        disabled={selectedProfession == null}
        variant="contained"
        aria-label="Select subclass"
        aria-controls="subclass-menu"
        aria-haspopup="true"
        aria-expanded={isSubclassMenuOpen ? "true" : undefined}
        onClick={handleSubclassMenuClick}
        className={classes.sortAndFilterButton}
      >
        {selectedSubProfessionId ? (
          <>
            <Image
              src={operatorBranchIcon(selectedSubProfessionId)}
              alt=""
              width={MENU_ICON_SIZE}
              height={MENU_ICON_SIZE}
            />
            {selectedSubclass}
          </>
        ) : (
          "All Branches"
        )}
      </Button>
      <Menu
        id="subclass-menu"
        open={isSubclassMenuOpen}
        anchorEl={anchorEl}
        MenuListProps={{
          "aria-labelledby": "subclass-menu-button",
        }}
        onClose={() => setIsSubclassMenuOpen(false)}
      >
        <ClassSubclassMenuItem
          onClick={handleSubclassClick(null)}
          className={selectedProfession == null ? "selected" : ""}
        >
          <ListItemText>All Branches</ListItemText>
        </ClassSubclassMenuItem>
        {Object.values(branches)
          .filter(
            ({ class: subclassClass }) =>
              subclassClass.profession === selectedProfession
          )
          .map(({ subProfessionId }) => (
            <ClassSubclassMenuItem
              key={subProfessionIdToSubclass(subProfessionId)}
              onClick={handleSubclassClick(subProfessionId)}
              className={
                selectedSubProfessionId === subProfessionId
                  ? "selected"
                  : undefined
              }
            >
              <ListItemIcon>
                <Image
                  src={operatorBranchIcon(subProfessionId)}
                  alt=""
                  width={MENU_ICON_SIZE}
                  height={MENU_ICON_SIZE}
                />
              </ListItemIcon>
              <ListItemText>
                {subProfessionIdToSubclass(subProfessionId)}
              </ListItemText>
            </ClassSubclassMenuItem>
          ))}
      </Menu>
      {(selectedProfession != null || selectedSubProfessionId != null) && (
        <button
          className={classes.resetFiltersButton}
          onClick={handleResetFilter}
        >
          Reset
        </button>
      )}
      <CustomCheckbox
        className={classes.guideAvailableCheckbox}
        label="Guide available"
        onChange={handleGuideAvailableChange}
        checked={showOnlyGuideAvailable}
      />
    </>
  );

  return (
    <Layout
      pageTitle="Operator List"
      bannerImage={operatorListBannerImage}
      blendPoint={496}
      /* No previous location for now
      previousLocation="Home"
      previousLocationLink="/"
       */
    >
      <GlobalStyles styles={globalOverrideStyles(theme)} />
      <main className={classes.main}>
        <div className={classes.mainContainer}>
          {/* <span className="last-updated">
          Last Updated:{" "}
          <span className="date">
            {lastUpdatedAt
              .setLocale("en-GB")
              .toLocaleString(DateTime.DATE_FULL)}
          </span>
        </span> */}
          <Media lessThan="mobile">
            <HorizontalScroller className={classes.sortAndFilterOptions}>
              {sortAndFilterOptions}
            </HorizontalScroller>
          </Media>
          <Media greaterThanOrEqual="mobile">
            <div className={classes.sortAndFilterOptions}>
              {sortAndFilterOptions}
            </div>
          </Media>

          {selectedProfession != null && (
            <div className={classes.toggleButtonContainer}>
              <button
                className={classes.toggleClassDescriptionsButton}
                aria-expanded={showClassDescriptions ? "true" : undefined}
                aria-controls="class-subclass-card-container"
                onClick={() => setShowClassDescriptions((curr) => !curr)}
              >
                Class Description
                <MdArrowForwardIos />
              </button>
            </div>
          )}
          <div className={classes.classSubclassDescriptions}>
            {showClassDescriptions && (
              <div id="class-subclass-card-container">
                {selectedProfession && selectedClass && (
                  <section className={classes.classDescriptionCard}>
                    <div className={classes.classDescriptionIconContainer}>
                      <Image
                        key={selectedClass}
                        src={operatorClassIcon(slugify(selectedClass))}
                        alt=""
                        width={64}
                        height={64}
                      />
                    </div>
                    <div className={classes.nameContainer}>
                      <h2 className={classes.classOrSubclassHeading}>
                        <span className="visually-hidden">
                          Selected class:{" "}
                        </span>
                        {selectedClass}
                      </h2>
                      <span className={classes.headingType} aria-hidden="true">
                        Class
                      </span>
                    </div>
                    <div className={classes.classOrSubclassDescription}>
                      <MDXRemote {...opClasses[selectedProfession].analysis} />
                    </div>
                  </section>
                )}
                {selectedSubProfessionId && (
                  <section className={classes.subclassDescriptionCard}>
                    <div className={classes.subclassDescriptionIconContainer}>
                      <Image
                        key={selectedSubProfessionId}
                        src={operatorBranchIcon(selectedSubProfessionId)}
                        alt=""
                        width={64}
                        height={64}
                      />
                    </div>
                    <div className={classes.nameContainer}>
                      <h3 className={classes.classOrSubclassHeading}>
                        <span className="visually-hidden">
                          Selected branch:{" "}
                        </span>
                        {selectedSubclass}
                      </h3>
                      <span className={classes.headingType} aria-hidden="true">
                        Branch
                      </span>
                    </div>
                    {selectedSubProfessionId && (
                      <div className={classes.traitInfoContainer}>
                        <TraitInfo
                          subProfessionId={selectedSubProfessionId}
                          showSubclassIcon={false}
                        />
                      </div>
                    )}
                    <div className={classes.classOrSubclassDescription}>
                      {branches[selectedSubProfessionId].analysis != null && (
                        <MDXRemote
                          {...branches[selectedSubProfessionId].analysis!}
                          components={{
                            BranchNamePlural: () => (
                              <strong>
                                {selectedSubclass!} {selectedClass!}s
                              </strong>
                            ),
                          }}
                        />
                      )}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </div>
        <div className={classes.resultsContainer}>
          <section className={classes.results}>
            <h2 className={classes.resultsHeading}>Operators</h2>
            <OperatorList
              operators={allOperators}
              filterSettings={filterSettings}
              operatorsWithGuides={operatorsWithGuides}
              onSubclassFilter={handleSubclassFilter}
            />
          </section>
        </div>
      </main>
    </Layout>
  );
};
export default Operators;

const globalOverrideStyles = (theme: Theme) => css`
  .top-fold {
    display: flex;
    flex-direction: column;
  }

  .header-main-wrapper {
    max-width: unset;
    margin: 0;
  }

  header {
    padding: ${theme.spacing(3, 0, 0, 0)};
    height: ${theme.spacing(30.5)};

    ${theme.breakpoints.down("mobile")} {
      position: relative;
    }

    &::before {
      ${theme.breakpoints.down("mobile")} {
        content: "";
        position: absolute;
        bottom: -16px;
        left: 0;
        width: 100%;
        height: 260px;
        background: linear-gradient(
          180deg,
          rgba(0, 0, 0, 0) 63.34%,
          rgba(0, 0, 0, 0.5) 100%
        );
      }
    }

    .heading-and-breadcrumb {
      max-width: ${theme.breakpoints.values["maxWidth"]}px;
      width: 100%;
      margin: 0 auto;

      ${theme.breakpoints.down("mobile")} {
        z-index: 1;
      }

      h1 {
        margin: ${theme.spacing(0, 3)};
        font-size: ${theme.typography.operatorPageHeading.fontSize}px;
        font-weight: ${theme.typography.operatorPageHeading.fontWeight};
        line-height: ${theme.typography.operatorPageHeading.lineHeight};

        ${theme.breakpoints.down("mobile")} {
          margin: ${theme.spacing(0, 2)};
          font-size: ${theme.typography.operatorNameHeading.fontSize}px;
        }
      }
    }
  }

  .page-content {
    flex: 1 1 0;
    display: flex;
  }

  footer {
    margin-top: 0;
  }
`;
